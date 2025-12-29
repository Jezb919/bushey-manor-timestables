// pages/api/admin/teachers/set_class.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function isUuid(v) {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export default async function handler(req, res) {
  try {
    // Auth: admin only
    const auth = await requireAdmin(req, res);
    if (!auth?.ok) return; // requireAdmin already responded

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { teacher_id: '<uuid>', class_label: 'B3' } or class_label: null to clear",
      });
    }

    const { teacher_id, class_label } = req.body || {};

    if (!isUuid(teacher_id)) {
      return res.status(400).json({ ok: false, error: "Invalid teacher_id (must be uuid)" });
    }

    // Normalise "none"
    const label = (class_label || "").toString().trim();
    const clearing = !label || label === "(none)" || label === "none" || label === "no class";

    // 1) Always clear existing assignment rows for this teacher (avoids ON CONFLICT issues)
    const del = await supabaseAdmin
      .from("teacher_classes")
      .delete()
      .eq("teacher_id", teacher_id);

    if (del.error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to clear existing class assignment",
        debug: del.error.message,
      });
    }

    // 2) If clearing, we're done
    if (clearing) {
      return res.status(200).json({ ok: true, assigned: null });
    }

    // 3) Look up class by class_label (NOT classes.label)
    const cls = await supabaseAdmin
      .from("classes")
      .select("id,class_label")
      .eq("class_label", label)
      .single();

    if (cls.error || !cls.data?.id) {
      return res.status(400).json({
        ok: false,
        error: `Class not found: ${label}`,
        debug: cls.error ? cls.error.message : "No class row returned",
      });
    }

    // 4) Insert new mapping using class_id
    const ins = await supabaseAdmin
      .from("teacher_classes")
      .insert({ teacher_id, class_id: cls.data.id })
      .select("teacher_id,class_id")
      .single();

    if (ins.error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to assign class",
        debug: ins.error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      assigned: { teacher_id, class_label: cls.data.class_label, class_id: cls.data.id },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: e?.message || String(e),
    });
  }
}
