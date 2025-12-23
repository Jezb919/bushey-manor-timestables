import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(cookieHeader = "") {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!raw) return null;

  try {
    // Your cookie is plain JSON and has teacherId
    const data = JSON.parse(raw);
    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;
    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // Optional filter
    const { class_label } = req.query;

    // We need students + their class_id/class_label.
    // Assumes tables: students, classes, teacher_classes (as you already have)
    // students should have: id, first_name/last_name OR name, class_id
    let studentsQuery = supabaseAdmin
      .from("students")
      .select("id, name, first_name, last_name, class_id, classes:class_id (id, class_label)");

    if (class_label) {
      studentsQuery = studentsQuery.eq("classes.class_label", class_label);
    }

    const { data: students, error: sErr } = await studentsQuery;
    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    // If admin, return all (or all in class_label if provided)
    if (isAdmin) {
      const out = (students || []).map((s) => ({
        id: s.id,
        name: s.name || [s.first_name, s.last_name].filter(Boolean).join(" ").trim(),
        class_label: s.classes?.class_label || null,
        class_id: s.class_id || s.classes?.id || null,
      }));
      return res.json({ ok: true, students: out });
    }

    // Teacher: filter to only classes assigned in teacher_classes
    const { data: links, error: lErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (lErr) return res.status(500).json({ ok: false, error: "Failed to check permissions", debug: lErr.message });

    const allowedClassIds = new Set((links || []).map((x) => x.class_id));
    const allowedStudents = (students || []).filter((s) => allowedClassIds.has(s.class_id));

    const out = allowedStudents.map((s) => ({
      id: s.id,
      name: s.name || [s.first_name, s.last_name].filter(Boolean).join(" ").trim(),
      class_label: s.classes?.class_label || null,
      class_id: s.class_id || s.classes?.id || null,
    }));

    return res.json({ ok: true, students: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
