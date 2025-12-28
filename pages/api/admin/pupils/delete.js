// pages/api/admin/pupils/delete.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const adminCheck = await requireAdmin(req, res);
  if (!adminCheck.ok) return;

  try {
    const { student_id } = req.body || {};
    if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

    // 1) Find attempts for this student (so we can delete related question_records first if they exist)
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("student_id", student_id);

    if (aErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);

    // 2) Delete question_records for those attempts (table name varies in projects; try a couple)
    if (attemptIds.length > 0) {
      // try "question_records"
      await supabaseAdmin.from("question_records").delete().in("attempt_id", attemptIds);
      // if you also have "attempt_question_records" or similar, add more deletes here later
    }

    // 3) Delete attempts (this fixes the FK constraint you hit)
    if (attemptIds.length > 0) {
      const { error: delAttemptsErr } = await supabaseAdmin.from("attempts").delete().eq("student_id", student_id);
      if (delAttemptsErr) {
        return res
          .status(500)
          .json({ ok: false, error: "Failed to delete attempts", debug: delAttemptsErr.message });
      }
    }

    // 4) Finally delete the student
    const { error: delStudentErr } = await supabaseAdmin.from("students").delete().eq("id", student_id);
    if (delStudentErr) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to delete pupil", debug: delStudentErr.message });
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
