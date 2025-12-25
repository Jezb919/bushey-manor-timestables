import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔐 Admin check
    const raw = req.cookies?.bmtt_teacher;
    if (!raw) return res.status(401).json({ ok: false, error: "Not logged in" });

    const session = JSON.parse(raw);
    if (session.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admins only" });
    }

    const { data, error } = await supabase
      .from("teachers")
      .select("id, full_name, email, role")
      .order("email");

    if (error) throw error;

    return res.json({ ok: true, teachers: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to load teachers", debug: String(e) });
  }
}
