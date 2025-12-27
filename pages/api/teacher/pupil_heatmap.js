import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      teacher_id: p.teacherId || p.teacher_id || null,
      role: p.role || null,
    };
  } catch {
    return null;
  }
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function guessIsCorrect(row) {
  // common fields
  if (typeof row.is_correct === "boolean") return row.is_correct;
  if (typeof row.correct === "boolean") return row.correct;

  // sometimes 1/0
  if (row.is_correct === 1 || row.is_correct === 0) return !!row.is_correct;
  if (row.correct === 1 || row.correct === 0) return !!row.correct;

  // sometimes "true"/"false"
  if (row.is_correct === "true" || row.is_correct === "false") return row.is_correct === "true";
  if (row.correct === "true" || row.correct === "false") return row.correct === "true";

  // last resort: compare answer vs user_answer
  const a = safeNum(row.answer ?? row.correct_answer);
  const u = safeNum(row.user_answer ?? row.given_answer);
  if (a !== null && u !== null) return a === u;

  return null;
}

function guessTable(row) {
  // If a 'table' column exists, use it
  const t = safeNum(row.table);
  if (t !== null) return t;

  // Try multiplicand/multiplier style
  const a = safeNum(row.multiplicand ?? row.a ?? row.left);
  const b = safeNum(row.multiplier ?? row.b ?? row.right);

  // "table" usually means the first number in UK tables (e.g. 7x8 is in 7-table)
  if (a !== null) return a;
  if (b !== null) return b;

  // Try parsing question text like "7 x 8" or "7×8"
  const q = String(row.question ?? row.prompt ?? row.text ?? "").trim();
  const m = q.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (m) return safeNum(m[1]);

  return null;
}

export default async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });

    const pupil_id = String(req.query.pupil_id || "").trim();
    if (!pupil_id) return res.status(400).json({ ok: false, error: "Missing pupil_id" });

    const limit = Math.min(Math.max(Number(req.query.limit || 12), 6), 30); // columns = attempts
    const maxTable = Math.min(Math.max(Number(req.query.max_table || 12), 6), 19);

    // Load pupil (for class_label)
    const { data: pupil, error: pErr } = await supabase
      .from("students")
      .select("id, class_label")
      .eq("id", pupil_id)
      .maybeSingle();

    if (pErr) return res.status(500).json({ ok: false, error: "Failed to load pupil", debug: pErr.message });
    if (!pupil) return res.status(404).json({ ok: false, error: "Pupil not found" });

    // Permission: admin ok; teacher must have class access
    if (session.role !== "admin") {
      // try teacher_classes has class_label
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("teacher_id, class_label, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_label", pupil.class_label)
        .maybeSingle();

      if (linkErr) {
        // fallback join via classes
        const { data: links2, error: linkErr2 } = await supabase
          .from("teacher_classes")
          .select("class_id, classes:class_id(class_label)")
          .eq("teacher_id", session.teacher_id);

        if (linkErr2) return res.status(403).json({ ok: false, error: "Permission check failed", debug: linkErr2.message });

        const allowed = (links2 || []).some((r) => r.classes?.class_label === pupil.class_label);
        if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed" });
      } else {
        if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
      }
    }

    // Latest attempts (columns)
    const { data: attempts, error: aErr } = await supabase
      .from("attempts")
      .select("id, created_at")
      .eq("student_id", pupil_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const cols = (attempts || []).map((a) => ({
      attempt_id: a.id,
      date: a.created_at,
    }));

    if (!cols.length) {
      // no attempts => empty heatmap
      return res.json({
        ok: true,
        columns: [],
        rows: Array.from({ length: maxTable }, (_, i) => i + 1),
        grid: [],
        note: "No attempts yet",
      });
    }

    const attemptIds = cols.map((c) => c.attempt_id);

    // Pull question records for these attempts
    const { data: qrecs, error: qErr } = await supabase
      .from("question_records")
      .select("*")
      .in("attempt_id", attemptIds);

    if (qErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load question records",
        debug: qErr.message,
        hint: "Your table is called question_records, and needs an attempt_id column for this heatmap.",
      });
    }

    // Build stats: stats[table][attempt_id] = { correct, total }
    const stats = {};
    for (let t = 1; t <= maxTable; t++) stats[t] = {};

    for (const r of qrecs || []) {
      const attempt_id = r.attempt_id;
      if (!attempt_id) continue;

      const table = guessTable(r);
      if (!table || table < 1 || table > maxTable) continue;

      const isCorrect = guessIsCorrect(r);
      if (isCorrect === null) continue;

      if (!stats[table][attempt_id]) stats[table][attempt_id] = { correct: 0, total: 0 };
      stats[table][attempt_id].total += 1;
      if (isCorrect) stats[table][attempt_id].correct += 1;
    }

    // Build grid: rows = tables 1..maxTable, cols = attempts newest->oldest
    const rows = Array.from({ length: maxTable }, (_, i) => i + 1);

    const grid = rows.map((t) => {
      return cols.map((c) => {
        const cell = stats[t][c.attempt_id];
        if (!cell || !cell.total) return null;
        const pct = Math.round((cell.correct / cell.total) * 100);
        return {
          pct,
          correct: cell.correct,
          total: cell.total,
        };
      });
    });

    return res.json({
      ok: true,
      columns: cols.map((c) => ({
        attempt_id: c.attempt_id,
        label: new Date(c.date).toLocaleDateString("en-GB"),
      })),
      rows,
      grid,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
