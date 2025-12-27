import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTeacherFromCookie(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return { ok: false, error: "Not logged in" };
  try {
    const parsed = JSON.parse(raw);
    const role = parsed.role;
    const teacherId = parsed.teacher_id || parsed.teacherId;
    if (!teacherId) return { ok: false, error: "Invalid session (missing teacherId)" };
    return { ok: true, teacherId, role };
  } catch (e) {
    return { ok: false, error: "Invalid session cookie" };
  }
}

async function teacherCanAccessStudent(teacherId, role, studentId) {
  if (role === "admin") return { ok: true };

  // find student's class_label
  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("id, class_label")
    .eq("id", studentId)
    .single();

  if (sErr) return { ok: false, error: "Failed to load pupil", debug: sErr.message };
  const classLabel = student?.class_label;

  // map teacher_classes -> classes(class_label)
  const { data, error } = await supabase
    .from("teacher_classes")
    .select("class_id, classes:class_id ( class_label )")
    .eq("teacher_id", teacherId);

  if (error) return { ok: false, error: "Permission check failed", debug: error.message };

  const labels = (data || []).map((r) => r.classes?.class_label).filter(Boolean);
  if (!labels.includes(classLabel)) return { ok: false, error: "Not allowed for this pupil" };

  return { ok: true, class_label: classLabel };
}

function pickField(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const { ok, teacherId, role, error } = getTeacherFromCookie(req);
    if (!ok) return res.status(401).json({ ok: false, error });

    const studentId = String(req.query.student_id || "").trim();
    if (!studentId) return res.status(400).json({ ok: false, error: "Missing student_id" });

    // permission
    const perm = await teacherCanAccessStudent(teacherId, role, studentId);
    if (!perm.ok) return res.status(403).json({ ok: false, error: perm.error, debug: perm.debug });

    // attempts (most recent first)
    const { data: attempts, error: aErr } = await supabase
      .from("attempts")
      .select("id, created_at, student_id")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const attemptIds = (attempts || []).map((a) => a.id);
    if (attemptIds.length === 0) {
      return res.json({ ok: true, student_id: studentId, attempts: [], rows: [] });
    }

    // question records for these attempts
    // (your table name might be question_records — if yours differs, tell me the exact table name and I’ll adjust)
    const { data: qrs, error: qErr } = await supabase
      .from("question_records")
      .select("*")
      .in("attempt_id", attemptIds);

    if (qErr) {
      return res.status(500).json({ ok: false, error: "Failed to load question records", debug: qErr.message });
    }

    // Build map: attempt_id -> tableNumber -> {correct,total}
    const agg = {};
    for (const qr of qrs || []) {
      const attemptId = qr.attempt_id;

      // flexible table field names
      const tableVal = pickField(qr, ["table", "table_number", "times_table", "mult_table", "tt"]);
      const t = Number(tableVal);

      if (!t || Number.isNaN(t)) continue;

      // flexible correctness field names
      const isCorrectRaw = pickField(qr, ["is_correct", "correct", "was_correct", "isCorrect"]);
      const isCorrect =
        isCorrectRaw === true ||
        isCorrectRaw === 1 ||
        isCorrectRaw === "true" ||
        isCorrectRaw === "t";

      if (!agg[attemptId]) agg[attemptId] = {};
      if (!agg[attemptId][t]) agg[attemptId][t] = { correct: 0, total: 0 };

      agg[attemptId][t].total += 1;
      if (isCorrect) agg[attemptId][t].correct += 1;
    }

    // Output grid rows for tables 1..19
    const attemptMeta = (attempts || []).map((a) => ({
      id: a.id,
      date: a.created_at,
      label: new Date(a.created_at).toLocaleDateString("en-GB"),
    }));

    const rows = [];
    for (let table = 1; table <= 19; table++) {
      const cells = attemptMeta.map((a) => {
        const bucket = agg[a.id]?.[table];
        if (!bucket || bucket.total === 0) return null;
        return Math.round((bucket.correct / bucket.total) * 100);
      });

      rows.push({ table, cells });
    }

    return res.json({
      ok: true,
      student_id: studentId,
      attempts: attemptMeta,
      rows,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
