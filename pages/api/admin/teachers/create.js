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
    return { teacher_id: p.teacherId || p.teacher_id || null, role: p.role || null };
  } catch {
    return null;
  }
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const email = String(req.body?.email || "").trim().toLowerCase();
    const full_name = String(req.body?.full_name || "").trim();
    const role = String(req.body?.role || "teacher").trim();

    if (!email) return res.status(400).json({ ok: false, error: "Missing email" });
    if (!["teacher", "admin"].includes(role)) return res.status(400).json({ ok: false, error: "Invalid role" });

    // unique by email
    const { data: existing } = await supabase.from("teachers").select("id").eq("email", email).maybeSingle();
    if (existing) return res.status(409).json({ ok: false, error: "Teacher already exists with that email" });

    const tempPassword = generateTempPassword();

    // Matches your current simple login (plain compare against password_hash)
    const password_hash = tempPassword;

    const { data, error } = await supabase
      .from("teachers")
      .insert([{ email, full_name, role, password_hash }])
      .select("id, email, full_name, role")
      .single();

    if (error) return res.status(500).json({ ok: false, error: "Failed to create teacher", debug: error.message });

    return res.json({
      ok: true,
      teacher: data,
      credentials: { email, tempPassword },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
