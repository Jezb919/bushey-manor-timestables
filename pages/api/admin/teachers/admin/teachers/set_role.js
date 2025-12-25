import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    // 🔐 Admin check
    const raw = req.cookies?.bmtt_teacher;
    if (!raw) return res.status(401).json({ ok: false, error: "Not logged in" });

    const session = JSON.parse(raw);
    if (session.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admins only" });
    }

    const { teacher_id, role } = req.body;
    if (!teacher_id || !role) {
      return res.status(400).json({ ok: false, error: "Missing data" });
    }

    if (!["admin", "teacher"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    const { error } = await supabase
      .from("teachers")
      .update({ role })
      .eq("id", teacher_id);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to update role", debug: String(e) });
  }
}

