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

function base64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return null;

  try {
    let json = token;
    if (!json.trim().startsWith("{")) json = base64UrlDecode(token);
    const data = JSON.parse(json);

    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;

    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

function displayName(s) {
  // your table only has first_name reliably right now
  return (s.first_name || s.username || (s.student_id != null ? String(s.student_id) : "") || s.id).trim();
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, username, student_id, year, class_label, class_id");

    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    if (isAdmin) {
      return res.json({
        ok: true,
        students: (students || []).map((s) => ({
          id: s.id, // ✅ UUID
          name: displayName(s),
          year: s.year ?? null,
          class_label: s.class_label ?? null,
          class_id: s.class_id ?? null,
        })),
      });
    }

    const { data: links, error: lErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (lErr) return res.status(500).json({ ok: false, error: "Failed to read teacher_classes", debug: lErr.message });

    const allowedClassIds = new Set((links || []).map((x) => x.class_id));
    const filtered = (students || []).filter((s) => s.class_id && allowedClassIds.has(s.class_id));

    return res.json({
      ok: true,
      students: filtered.map((s) => ({
        id: s.id, // ✅ UUID
        name: displayName(s),
        year: s.year ?? null,
        class_label: s.class_label ?? null,
        class_id: s.class_id ?? null,
      })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
