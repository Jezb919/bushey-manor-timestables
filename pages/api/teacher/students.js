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

function studentDisplayName(s) {
  const first = s.first_name || s.firstname || s.given_name || "";
  const last = s.last_name || s.lastname || s.surname || "";
  const full = [first, last].filter(Boolean).join(" ").trim();

  // fallback to something stable if names missing
  return full || s.username || s.upn || s.id;
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // ✅ Only select columns that should exist (no "name")
    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_id, class_label");

    if (sErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        debug: sErr.message,
        next_step:
          "If this mentions another missing column, tell me which one and I’ll adjust the select list.",
      });
    }

    // Admin = all students
    if (isAdmin) {
      return res.json({
        ok: true,
        students: (students || []).map((s) => ({
          id: s.id,
          name: studentDisplayName(s),
          class_id: s.class_id || null,
          class_label: s.class_label || null,
        })),
      });
    }

    // Teacher = only their linked classes
    const { data: links, error: lErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (lErr) {
      return res.status(500).json({ ok: false, error: "Failed to read teacher_classes", debug: lErr.message });
    }

    const allowedClassIds = new Set((links || []).map((x) => x.class_id));

    const filtered = (students || []).filter((s) => {
      // Prefer class_id linking. If your students use class_label only, we’ll adjust next.
      return s.class_id && allowedClassIds.has(s.class_id);
    });

    return res.json({
      ok: true,
      students: filtered.map((s) => ({
        id: s.id,
        name: studentDisplayName(s),
        class_id: s.class_id || null,
        class_label: s.class_label || null,
      })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
