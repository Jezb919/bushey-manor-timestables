import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      teacher_id: p.teacherId || p.teacher_id || null,
      role: p.role || null,
    };
  } catch {
    return null;
  }
}

function cleanName(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z \-']/g, "");
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomPassword(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function generateUniqueUsername(first_name, surname) {
  const f = slug(first_name);
  const s = slug(surname);
  const initial = s ? s[0] : "x";
  const base = `${f}${initial}` || "pupil";

  for (let n = 1; n <= 999; n++) {
    const candidate = `${base}${n}`;
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }

  return `${base}${Date.now()}`.slice(0, 20);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const class_label = String(req.body?.class_label || "").trim();
    const first_name = cleanName(req.body?.first_name);
    const surname = cleanName(req.body?.surname);

    if (!class_label) return res.status(400).json({ ok: false, error: "Missing class" });
    if (!first_name) return res.status(400).json({ ok: false, error: "Missing first name" });
    if (!surname) return res.status(400).json({ ok: false, error: "Missing surname" });

    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("class_label", class_label)
      .maybeSingle();

    const username = await generateUniqueUsername(first_name, surname);
    const tempPassword = randomPassword(8);

    const row = {
      first_name,
      surname,
      class_label,
      username,
      password_hash: tempPassword,
    };
    if (cls?.id) row.class_id = cls.id;

    const { data: pupil, error } = await supabase
      .from("students")
      .insert([row])
      .select("id, first_name, surname, class_label, username")
      .single();

    if (error) return res.status(500).json({ ok: false, error: "Failed to create pupil", debug: error.message });

    return res.json({
      ok: true,
      pupil,
      credentials: { username, tempPassword },
      note: "Copy the password now (it will not be shown again).",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
