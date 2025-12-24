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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    // ✅ Only admins can add pupils (simple + safe)
    if (session.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admins only" });
    }

    const { first_name, username, student_id, class_id } = req.body || {};

    if (!first_name || !class_id) {
      return res.status(400).json({ ok: false, error: "Missing first_name or class_id" });
    }

    // Get class_label automatically (so things stay consistent)
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("id", class_id)
      .maybeSingle();

    if (clsErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // Insert pupil
    const { data: created, error: insErr } = await supabaseAdmin
      .from("students")
      .insert({
        first_name: String(first_name).trim(),
        username: username ? String(username).trim() : null,
        student_id: student_id ? String(student_id).trim() : null,
        class_id: cls.id,
        class_label: cls.class_label,
      })
      .select("id, first_name, username, student_id, class_id, class_label")
      .single();

    if (insErr) {
      return res.status(500).json({ ok: false, error: "Failed to create pupil", debug: insErr.message });
    }

    return res.json({ ok: true, pupil: created });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
