import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed (POST only)",
      info: "Send JSON: { teacher_id, class_label } where class_label can be null/'' for none",
    });
  }

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { teacher_id, class_label } = req.body || {};
    if (!teacher_id) {
      return res.status(400).json({ ok: false, error: "Missing teacher_id" });
    }

    // Normalise "(none)" / empty to null
    const label =
      !class_label || class_label === "(none)" || class_label === "no class"
        ? null
        : String(class_label).trim();

    // If clearing assignment: delete row from teacher_classes
    if (!label) {
      const del = await supabaseAdmin
        .from("teacher_classes")
        .delete()
        .eq("teacher_id", teacher_id);

      if (del.error) {
        return res.status(500).json({ ok: false, error: "Failed to clear assignment", debug: del.error.message });
      }

      return res.status(200).json({ ok: true, teacher_id, class_label: null });
    }

    // Find class by class_label (your DB uses class_label, not classes.label)
    const cls = await supabaseAdmin
      .from("classes")
      .select("id,class_label")
      .eq("class_label", label)
      .maybeSingle();

    if (cls.error) {
      return res.status(500).json({ ok: false, error: "Failed to look up class", debug: cls.error.message });
    }
    if (!cls.data) {
      return res.status(400).json({ ok: false, error: `Class not found: ${label}` });
    }

    // Upsert assignment (requires UNIQUE(teacher_id) which you just added)
    const up = await supabaseAdmin
      .from("teacher_classes")
      .upsert(
        {
          teacher_id,
          class_id: cls.data.id,
          class_label: cls.data.class_label,
        },
        { onConflict: "teacher_id" }
      )
      .select("*")
      .single();

    if (up.error) {
      return res.status(500).json({ ok: false, error: "Failed to assign class", debug: up.error.message });
    }

    return res.status(200).json({
      ok: true,
      teacher_id,
      class_label: up.data.class_label,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
