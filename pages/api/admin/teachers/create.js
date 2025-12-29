// pages/api/admin/teachers/create.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Admin check
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, error: auth.error });
  }

  try {
    const { full_name, email, role, class_label } = req.body || {};

    const cleanName = String(full_name || "").trim();
    const cleanEmail = normaliseEmail(email);
    const cleanRole = role === "admin" ? "admin" : "teacher"; // lock down roles

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({ ok: false, error: "Missing name or email" });
    }

    // Find class by label (or allow null for admins/unassigned)
    let class_id = null;
    let classLabelOut = null;

    if (class_label && String(class_label).trim() && String(class_label) !== "(none)") {
      const wanted = String(class_label).trim();

      const { data: cls, error: clsErr } = await supabaseAdmin
        .from("classes")
        .select("id,class_label")
        .eq("class_label", wanted)
        .maybeSingle();

      if (clsErr) {
        return res.status(500).json({ ok: false, error: "Class lookup failed", debug: clsErr.message });
      }
      if (!cls) {
        return res.status(400).json({ ok: false, error: `Class not found: ${wanted}` });
      }

      class_id = cls.id;
      classLabelOut = cls.class_label;
    }

    // Create teacher row
    const { data: created, error: insErr } = await supabaseAdmin
      .from("teachers")
      .insert({
        full_name: cleanName,
        email: cleanEmail,
        role: cleanRole,
        class_id,
        class_label: classLabelOut, // ok if null
      })
      .select("id,full_name,email,role,class_id,class_label,created_at")
      .single();

    if (insErr) {
      return res.status(500).json({ ok: false, error: "Failed to create teacher", debug: insErr.message });
    }

    return res.status(200).json({ ok: true, teacher: created });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
