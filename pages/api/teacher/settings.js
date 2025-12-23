import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IMPORTANT: this is your existing way of getting the teacher session.
// Keep your current session code here and just ensure it gives you teacher_id + role.
async function getTeacherFromSession(req) {
  // TODO: keep your existing logic (cookie/session token).
  // Must return: { teacher_id: "uuid", role: "teacher"|"admin" }
  return null;
}

export default async function handler(req, res) {
  try {
    const { class_label } = req.query;

    const session = await getTeacherFromSession(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // Admin bypass (optional)
    if (session.role === "admin") {
      // continue to return settings as you already do
    }

    // 1) Look up the class_id from the label (M4)
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // 2) Check the mapping exists (teacher_classes)
    const { data: link, error: linkErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("teacher_id, class_id")
      .eq("teacher_id", session.teacher_id)
      .eq("class_id", cls.id)
      .maybeSingle();

    if (linkErr) {
      return res.status(500).json({ ok: false, error: "Access check failed", debug: linkErr.message });
    }

    if (!link) {
      return res.status(403).json({
        ok: false,
        error: "Not allowed for this class",
        debug: { teacher_id: session.teacher_id, role: session.role, class_label }
      });
    }

    // ✅ ALLOWED — now fetch and return settings (keep your existing code here)
    // Example:
    const { data: settings } = await supabaseAdmin
      .from("teacher_settings")
      .select("*")
      .eq("class_id", cls.id)
      .maybeSingle();

    return res.json({ ok: true, class: cls, settings: settings || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
