import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseTeacherCookie(req) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map(s => s.trim()).find(s => s.startsWith("bmtt_teacher="));
  if (!match) return null;

  const val = decodeURIComponent(match.split("=").slice(1).join("="));
  try {
    const obj = JSON.parse(val);
    return {
      teacher_id: obj.teacher_id || obj.teacherId,
      role: obj.role
    };
  } catch {
    return null;
  }
}

function guessTableNumber(r) {
  return (
    r.table ??
    r.table_number ??
    r.times_table ??
    r.timestable ??
    r.multiplier ??
    r.tableValue ??
    null
  );
}

function guessCorrect(r) {
  const v = r.is_correct ?? r.correct ?? r.was_correct ?? r.isCorrect ?? null;
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";
  return null;
}

export default async function handler(req, res) {
  try {
    const session = parseTeacherCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const { student_id, debug } = req.query;
    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    // Load pupil
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, username, class_id, class_label")
      .eq("id", student_id)
      .single();

    if (pupilErr || !pupil) {
      return res.status(404).json({ ok: false, error: "Pupil not found", debug: pupilErr?.message });
    }

    // Permission check
    if (session.role !== "admin") {
      let classId = pupil.class_id;

      if (!classId && pupil.class_label) {
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id")
          .eq("class_label", pupil.class_label)
          .maybeSingle();
        classId = cls?.id || null;
      }

      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", classId)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!link) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }
    }

    // Get recent attempts
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    if (!attempts || attempts.length === 0) {
      return res.json({ ok: true, heatmap: null, note: "No attempts yet" });
    }

    const attemptIds = attempts.map(a => a.id);

    // Pull question records (we select * to avoid “missing column” issues)
    const { data: records, error: recErr } = await supabaseAdmin
      .from("question_records")
      .select("*")
      .in("attempt_id", attemptIds);

    if (recErr) {
      return res.status(500).json({ ok: false, error: "Failed to load question records", debug: recErr.message });
    }

    // Build heatmap: rows 1–19, columns by attempt date
    const cols = attempts.map(a => new Date(a.created_at).toLocaleDateString("en-GB"));

    // stats[table][colIndex] = { correct, total }
    const stats = {};
    for (let t = 1; t <= 19; t++) stats[t] = cols.map(() => ({ correct: 0, total: 0 }));

    // Map attempt_id -> column index
    const colIndexByAttempt = new Map();
    attempts.forEach((a, idx) => colIndexByAttempt.set(a.id, idx));

    for (const r of records || []) {
      const idx = colIndexByAttempt.get(r.attempt_id);
      if (idx === undefined) continue;

      const t = Number(guessTableNumber(r));
      if (!t || t < 1 || t > 19) continue;

      const c = guessCorrect(r);
      if (c === null) continue;

      stats[t][idx].total += 1;
      if (c) stats[t][idx].correct += 1;
    }

    const rows = [];
    for (let t = 1; t <= 19; t++) {
      const cells = stats[t].map(s => {
        if (!s.total) return { score: null };
        return { score: Math.round((s.correct / s.total) * 100) };
      });
      rows.push({ table: t, cells });
    }

    const heatmap = { columns: cols, rows };

    return res.json({
      ok: true,
      heatmap,
      ...(debug ? { debug: { attemptIds, recordCount: (records || []).length } } : {})
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
