// pages/api/admin/pupils/delete.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import requireAdmin from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const me = await requireAdmin(req, res);
    if (!me) return;

    const { student_id } = req.body || {};
    const id = String(student_id || "").trim();

    if (!id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    // 1) Find attempts for this pupil
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("student_id", id);

    if (aErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);

    // 2) Delete question_records first (if table exists / used)
    // If your project uses "question_records" linked to attempt_id, this prevents FK failures.
    if (attemptIds.length) {
      // Try-delete pattern: if the table doesn't exist in your DB, ignore that specific error.
      const { error: qrErr } = await supabaseAdmin
        .from("question_records")
        .delete()
        .in("attempt_id", attemptIds);

      // Some Supabase setups return error "Could not find the table" – we ignore that.
      if (qrErr && !String(qrErr.message || "").toLowerCase().includes("could not find the table")) {
        return res.status(500).json({ ok: false, error: "Failed to delete question records", debug: qrErr.message });
      }
    }

    // 3) Delete attempts
    if (attemptIds.length) {
      const { error: delAttemptsErr } = await supabaseAdmin
        .from("attempts")
        .delete()
        .eq("student_id", id);

      if (delAttemptsErr) {
        return res.status(500).json({ ok: false, error: "Failed to delete attempts", debug: delAttemptsErr.message });
      }
    }

    // 4) Delete pupil
    const { error: delStudentErr } = await supabaseAdmin
      .from("students")
      .delete()
      .eq("id", id);

    if (delStudentErr) {
      return res.status(500).json({ ok: false, error: "Failed to delete pupil", debug: delStudentErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
