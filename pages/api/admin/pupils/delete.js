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
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const { pupil_id } = req.body || {};
    if (!pupil_id) return res.status(400).json({ ok: false, error: "Missing pupil_id" });

    // Optional safety: delete attempts first (only if you want clean removal)
    // If your attempts table has a FK with cascade, you can remove this.
    const { error: aErr } = await supabase.from("attempts").delete().eq("student_id", pupil_id);
    if (aErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to delete pupil attempts",
        debug: aErr.message,
        note: "If you want to keep attempts history, tell me and we’ll change this.",
      });
    }

    const { error: sErr } = await supabase.from("students").delete().eq("id", pupil_id);
    if (sErr) return res.status(500).json({ ok: false, error: "Failed to delete pupil", debug: sErr.message });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
