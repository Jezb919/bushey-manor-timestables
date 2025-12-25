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

    const teacher_id = req.body?.teacher_id;
    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    const tempPassword = generateTempPassword();
    const password_hash = tempPassword;

    const { data, error } = await supabase
      .from("teachers")
      .update({ password_hash })
      .eq("id", teacher_id)
      .select("id, email, full_name, role")
      .single();

    if (error) return res.status(500).json({ ok: false, error: "Failed to reset password", debug: error.message });

    return res.json({ ok: true, teacher: data, credentials: { email: data.email, tempPassword } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
