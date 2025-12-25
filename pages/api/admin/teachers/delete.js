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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const teacher_id = req.body?.teacher_id;
    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    // Safety: don't delete yourself
    if (teacher_id === session.teacher_id) {
      return res.status(400).json({ ok: false, error: "You cannot delete your own account" });
    }

    const { error } = await supabase.from("teachers").delete().eq("id", teacher_id);
    if (error) return res.status(500).json({ ok: false, error: "Failed to delete teacher", debug: error.message });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
