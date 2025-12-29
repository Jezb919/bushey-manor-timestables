// pages/api/admin/teachers/create.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function clean(s) {
  return String(s ?? "").trim();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  try {
    // Admin only
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const full_name = clean(req.body?.full_name);
    const email = clean(req.body?.email).toLowerCase();
    const role = clean(req.body?.role || "teacher"); // "teacher" or "admin"
    const class_label = clean(req.body?.class_label || ""); // optional

    if (!full_name) return res.status(400).json({ ok: false, error: "Missing full_name" });
    if (!email || !isEmail(email)) return res.status(400).json({ ok: false, error: "Invalid email" });
    if (!["teacher", "admin"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    // Check if teacher exists
    const existing = await supabaseAdmin
      .from("teachers")
      .select("id,email")
      .eq("email", email)
      .maybeSingle();

    if (existing.error) {
      return res.status(500).json({ ok: false, error: "DB error", debug: existing.error.message });
    }
    if (existing.data) {
      return res.status(409).json({ ok: false, error: "Teacher already exists with that email" });
    }

    // Optional class lookup
    let class_id = null;
    let classLabelToStore = null;

    if (class_label) {
      // Your schema has classes.class_label (NOT classes.label)
      const cls = await supabaseAdmin
        .from("classes")
        .select("id,class_label")
        .eq("class_label", class_label)
        .maybeSingle();

      if (cls.error) {
        return res.status(500).json({ ok: false, error: "Failed to lookup class", debug: cls.error.message });
      }
      if (!cls.data) {
        return res.status(400).json({ ok: false, error: "Class not found", debug: class_label });
      }
      class_id = cls.data.id;
      classLabelToStore = cls.data.class_label;
    }

    // Create teacher record
    // NOTE: we don’t set a password here; you already have “Send setup link”
    // so the teacher can set their own password securely.
    const insert = await supabaseAdmin
      .from("teachers")
      .insert({
        full_name,
        email,
        role,
        class_id: class_id,
        class_label: classLabelToStore, // keep if your table has it; harmless if it exists
      })
      .select("id,full_name,email,role,class_id,class_label")
      .single();

    if (insert.error) {
      return res.status(500).json({ ok: false, error: "Failed to create teacher", debug: insert.error.message });
    }

    return res.status(200).json({
      ok: true,
      teacher: insert.data,
      info: "Teacher created. Now click 'Send setup link' to set their password.",
      debug: { admin_role: admin.role, admin_id: admin.teacher_id || admin.teacherId },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
