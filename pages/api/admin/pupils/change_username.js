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

function cleanUsername(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const { student_id, new_username } = req.body || {};
    if (!student_id || !new_username) return res.status(400).json({ ok: false, error: "Missing student_id or new_username" });

    const username = cleanUsername(new_username);
    if (!username) return res.status(400).json({ ok: false, error: "Username not valid" });

    // check unique
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (exErr) return res.status(500).json({ ok: false, error: "Failed to check username", debug: exErr.message });
    if (existing && existing.id !== student_id) {
      return res.status(409).json({ ok: false, error: "Username already taken" });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("students")
      .update({ username })
      .eq("id", student_id)
      .select("id, first_name, last_name, username, class_label")
      .single();

    if (error) return res.status(500).json({ ok: false, error: "Failed to change username", debug: error.message });

    return res.json({ ok: true, pupil: updated });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
