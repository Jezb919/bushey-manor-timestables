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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const { teacher_id, role } = req.body || {};
    if (!teacher_id || !role) return res.status(400).json({ ok: false, error: "Missing teacher_id or role" });
    if (!["admin", "teacher"].includes(role)) return res.status(400).json({ ok: false, error: "Invalid role" });

    const { error } = await supabase.from("teachers").update({ role }).eq("id", teacher_id);
    if (error) return res.status(500).json({ ok: false, error: "DB update failed", debug: error.message });

    return res.json({ ok: true });
  } catch (e) {
    // ✅ Always JSON
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
