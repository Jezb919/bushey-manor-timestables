// pages/api/teacher/pupil_heatmap.js
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

/**
 * ✅ Robust correctness detection across many possible column names
 */
function guessIsCorrect(row) {
  const boolFields = [
    "is_correct",
    "isCorrect",
    "correct",
    "was_correct",
    "wasCorrect",
    "right",
    "is_right",
  ];

  for (const f of boolFields) {
    if (typeof row[f] === "boolean") return row[f];
    if (row[f] === 1 || row[f] === 0) return !!row[f];
    if (row[f] === "true" || row[f] === "false") return row[f] === "true";
  }

  const scoreFields = ["score", "question_score", "mark"];
  for (const f of scoreFields) {
    const v = safeNum(row[f]);
    if (v === 1) return true;
    if (v === 0) return false;
  }

  const a = safeNum(row.answer ?? row.correct_answer ?? row.expected_answer);
  const u = safeNum(row.user_answer ?? row.given_answer ?? row.response_answer);
  if (a !== null && u !== null) return a === u;

  return null;
}

/**
 * ✅ Robust "table number" detection across many possible schemas
 */
function guessTable(row) {
  const directFields = [
    "table",
    "table_number",
    "tableNumber",
    "times_table",
    "timesTable",
    "table_base",
    "base_table",
  ];
  for (const f of directFields) {
    const t = safeNum(row[f]);
    if (t !== null) return t;
  }

  const a = safeNum(row.multiplicand ?? row.a ?? row.left ?? row.first ?? row.num1);
  const b = safeNum(row.multiplier ?? row.b ?? row.right ?? row.second ?? row.num2);

  // Often the table is the multiplicand (e.g., 7 × 8 => table 7)
  if (a !== null) return a;
  if (b !== null) return b;

  const q = String(row.question ?? row.prompt ?? row.text ?? row.expression ?? "").trim();
  const m = q.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (m) return safeNum(m[1]);

  return null;
}

export default async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const pupil_id = String(req.query.pupil_id || "").trim();
    if (!pupil_id) {
      return res.status(400).json({ ok: false, error: "Missing pupil_id" });
    }

    const debug = String(req.query.debug || "") === "1";
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 6), 40); // attempts columns
    const maxTable = Math.min(Math.max(Number(req.query.max_table || 19), 6), 19);

    // Load pupil
    const { data: pupil, error: pErr } = await supabase
      .from("students")
      .select("id, class_label")
      .eq("id", pupil_id)
      .maybeSingle();

    if (pErr) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to load pupil", debug: pErr.message });
    }
    if (!pupil) return res.status(404).json({ ok: false, error: "Pupil not found" });

    // Permission: admin sees all, teacher only their class
    if (session.role !== "admin") {
      // Preferred: direct class_label mapping
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("teacher_id, class_label, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_label", pupil.class_label)
        .maybeSingle();

      if (linkErr) {
        // Fallback: class_id join to classes
        const { data: links2, error: linkErr2 } = await supabase
          .from("teacher_classes")
          .select("class_id, classes:class_id(class_label)")
          .eq("teacher_id", session.teacher_id);

        if (linkErr2) {
          return res
            .status(403)
            .json({ ok: false, error: "Permission check failed", debug: linkErr2.message });
        }

        const allowed = (links2 || []).some((r) => r.classes?.class_label === pupil.class_label);
        if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed" });
      } else {
        if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
      }
    }

    // Latest attempts (most recent first)
    const { data: attempts, error: aErr } = await supabase
      .from("attempts")
      .select("id, created_at")
      .eq("student_id", pupil_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (aErr) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to load attempts", debug: aErr.message });
    }

    const cols = (attempts || []).map((a) => ({
      attempt_id: a.id,
      date: a.created_at,
    }));

    if (!cols.length) {
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
        hint: "Heatmap needs question_records.attempt_id to link to attempts.id",
      });
    }

    // stats[table][attempt_id] = { correct, total }
    const stats = {};
    for (let t = 1; t <= maxTable; t++) stats[t] = {};

    let parsed = { rows: 0, withAttempt: 0, withTable: 0, withCorrect: 0, used: 0 };
    let sampleKeys = null;

    for (const r of qrecs || []) {
      parsed.rows += 1;
      if (!sampleKeys) sampleKeys = Object.keys(r || {}).slice(0, 60);

      const attempt_id = r.attempt_id;
      if (!attempt_id) continue;
      parsed.withAttempt += 1;

      const table = guessTable(r);
      if (!table || table < 1 || table > maxTable) continue;
      parsed.withTable += 1;

      const isCorrect = guessIsCorrect(r);
      if (isCorrect === null) continue;
      parsed.withCorrect += 1;

      if (!stats[table][attempt_id]) stats[table][attempt_id] = { correct: 0, total: 0 };
      stats[table][attempt_id].total += 1;
      if (isCorrect) stats[table][attempt_id].correct += 1;

      parsed.used += 1;
    }

    const rows = Array.from({ length: maxTable }, (_, i) => i + 1);

    // grid: rows (tables) × columns (attempts)
    const grid = rows.map((t) => {
      return cols.map((c) => {
        const cell = stats[t][c.attempt_id];
        if (!cell || !cell.total) return null;
        const pct = Math.round((cell.correct / cell.total) * 100);
        return { pct, correct: cell.correct, total: cell.total };
      });
    });

    // ✅ IMPORTANT FIX: label includes time so 2+ attempts same day do NOT collide
    const columns = cols.map((c, i) => {
      const d = new Date(c.date);
      const date = d.toLocaleDateString("en-GB");
      const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return {
        attempt_id: c.attempt_id,
        label: `${date} ${time}`, // unique per attempt
        short: date,
        index: i + 1,
      };
    });

    const resp = { ok: true, columns, rows, grid };

    if (debug) {
      resp.debug = {
        attempts_returned: cols.length,
        question_records_returned: (qrecs || []).length,
        parsed,
        sample_question_record_keys: sampleKeys,
        note:
          parsed.used === 0
            ? "Heatmap blank because we couldn't detect table number and/or correctness from your question_records schema."
            : "Heatmap has usable parsed data.",
      };
    }

    return res.json(resp);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
