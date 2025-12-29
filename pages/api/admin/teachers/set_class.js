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
    if (!teacher_id || !class_label) {
      return res.status(400).json({ ok: false, error: "Missing teacher_id or class_label" });
    }

    // Find the class by class_label (your DB uses class_label, not classes.label)
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found", debug: classErr?.message });
    }

    // Upsert assignment (one class per teacher)
    const { error: upsertErr } = await supabaseAdmin
      .from("teacher_class_assignments")
      .upsert(
        { teacher_id, class_id: cls.id },
        { onConflict: "teacher_id" }
      );

    if (upsertErr) {
      return res.status(500).json({ ok: false, error: "Failed to assign class", debug: upsertErr.message });
    }

    return res.status(200).json({ ok: true, teacher_id, class_label: cls.class_label });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
