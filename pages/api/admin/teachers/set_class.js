// pages/api/admin/teachers/set_class.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  // Helpful debug info if you open it in browser
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      info:
        "POST only. Send JSON: { teacher_id (or teacherId), class_label (or classLabel) }. class_label null/'' clears.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
  }

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const teacher_id = body.teacher_id || body.teacherId;
    const class_label_raw = body.class_label ?? body.classLabel ?? "";
    const class_label = String(class_label_raw || "").trim(); // may be ""

    if (!teacher_id) {
      return res.status(400).json({ ok: false, error: "Missing teacher_id" });
    }

    // 1) Always clear existing assignment(s) for that teacher
    const del = await supabaseAdmin.from("teacher_classes").delete().eq("teacher_id", teacher_id);
    if (del.error) {
      return res.status(500).json({
        ok: false,
        error: "Failed clearing existing class assignment",
        debug: del.error.message,
      });
    }

    // 2) If class_label blank -> that is "no class" (done)
    if (!class_label) {
      return res.status(200).json({
        ok: true,
        info: "Cleared assigned class",
        debug: { teacher_id, class_label: "" },
      });
    }

    // 3) Find class by class_label (your DB uses classes.class_label)
    const cls = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .maybeSingle();

    if (cls.error) {
      return res.status(500).json({ ok: false, error: "Failed to lookup class", debug: cls.error.message });
    }
    if (!cls.data) {
      return res.status(404).json({ ok: false, error: `Class not found: ${class_label}` });
    }

    // 4) Insert new assignment
    const ins = await supabaseAdmin.from("teacher_classes").insert({
      teacher_id,
      class_id: cls.data.id,
    });

    if (ins.error) {
      return res.status(500).json({ ok: false, error: "Failed to assign class", debug: ins.error.message });
    }

    return res.status(200).json({
      ok: true,
      info: "Assigned class",
      class: cls.data,
      debug: { teacher_id, class_label: cls.data.class_label },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
