import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const admin = await requireAdmin(req, res);
    if (!admin?.ok) return; // requireAdmin already responded

    const { teacher_id, class_label } = req.body || {};

    if (!teacher_id) {
      return res.status(400).json({ ok: false, error: "Missing teacher_id" });
    }

    // Allow null/empty to mean "unassigned"
    const clean = (class_label || "").trim().toUpperCase();
    const newValue = clean === "" ? null : clean;

    const { data, error } = await supabaseAdmin
      .from("teachers")
      .update({ class_label: newValue })
      .eq("id", teacher_id)
      .select("id,email,full_name,role,class_label")
      .single();

    if (error) {
      return res.status(500).json({ ok: false, error: "Failed to set class", debug: error.message });
    }

    return res.json({ ok: true, teacher: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
