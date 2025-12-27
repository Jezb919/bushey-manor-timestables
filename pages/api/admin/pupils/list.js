import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Use GET" });

  const adminCheck = await requireAdmin(req, res);
  if (!adminCheck?.ok) return;

  const { class_label } = req.query || {};
  if (!class_label) return res.status(400).json({ ok: false, error: "Missing class_label" });

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, username, class_label")
    .eq("class_label", class_label)
    .order("first_name", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: error.message });

  return res.json({ ok: true, pupils: data || [] });
}
