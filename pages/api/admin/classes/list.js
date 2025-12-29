// pages/api/admin/classes/list.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed (GET only)" });
  }

  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return; // requireAdmin already responded

    // IMPORTANT: your DB uses classes.class_label (NOT classes.label)
    const { data, error } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .order("class_label", { ascending: true });

    if (error) {
      return res.status(500).json({ ok: false, error: "Failed to load classes", debug: error.message });
    }

    return res.status(200).json({
      ok: true,
      classes: (data || []).map((c) => ({ id: c.id, class_label: c.class_label })),
      debug: { count: (data || []).length, admin: { role: admin.role, teacher_id: admin.teacher_id } },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
