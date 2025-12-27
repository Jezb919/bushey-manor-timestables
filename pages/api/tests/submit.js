import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function getStudentIdFromCookie(req) {
  const cookies = parseCookies(req);
  const raw = cookies.bmtt_student;
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw);
    return obj.student_id || obj.studentId || obj.id || null;
  } catch {
    return null;
  }
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function normaliseAnswers(body) {
  // Your frontend might send answers under different keys. We support a few.
  const candidates = [
    body.answers,
    body.results,
    body.responses,
    body.questions, // sometimes people name it this
    body.items,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }

  return [];
}

/**
 * Normalise a single question result to a standard structure:
 * {
 *   table_number: 1..19,
 *   is_correct: boolean,
 * }
 *
 * Supports multiple shapes like:
 * { a:7, b:8, user_answer:56, correct_answer:56 }
 * { table_number:7, is_correct:true }
 * { table:7, correct:true }
 */
function normaliseQuestionRow(q) {
  // infer table number
  const tableCandidate =
    q.table_number ??
    q.tableNumber ??
    q.table ??
    q.times_table ??
    q.timesTable ??
    q.a; // common pattern where a is the table

  const table_number = toNum(tableCandidate);

  // infer correctness
  let is_correct = null;

  if (typeof q.is_correct === "boolean") is_correct = q.is_correct;
  if (typeof q.correct === "boolean") is_correct = q.correct;

  if (is_correct === null) {
    // compare answers if present
    const ua = toNum(q.user_answer ?? q.userAnswer ?? q.answer ?? q.given_answer);
    const ca = toNum(q.correct_answer ?? q.correctAnswer ?? q.expected_answer);

    if (ua !== null && ca !== null) is_correct = ua === ca;
  }

  // if still unknown, ignore this record
  if (!Number.isFinite(table_number) || table_number < 1 || table_number > 19) return null;
  if (typeof is_correct !== "boolean") return null;

  return { table_number, is_correct };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 1) Identify student
    let student_id = body.student_id || body.studentId || null;
    if (!student_id) {
      student_id = getStudentIdFromCookie(req);
    }

    if (!student_id) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in as a pupil",
        note: "No student_id in POST body and no bmtt_student cookie found.",
      });
    }

    // 2) Get answers
    const rawAnswers = normaliseAnswers(body);
    if (!rawAnswers.length) {
      return res.status(400).json({
        ok: false,
        error: "Missing answers",
        note: "Expected an array in body.answers (or results/responses/questions).",
      });
    }

    // 3) Normalise questions for question_records
    const qRows = [];
    let correctCount = 0;

    for (const q of rawAnswers) {
      const row = normaliseQuestionRow(q);
      if (!row) continue;
      qRows.push(row);
      if (row.is_correct) correctCount += 1;
    }

    const totalCount = qRows.length || rawAnswers.length;
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // 4) Load pupil class_label (so attempts are consistent)
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("id, class_label, class_id")
      .eq("id", student_id)
      .single();

    if (pupilErr || !pupil) {
      return res.status(404).json({
        ok: false,
        error: "Pupil not found in students table",
        debug: pupilErr?.message,
      });
    }

    const class_label = pupil.class_label || body.class_label || body.classLabel || null;

    // 5) Create attempt
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([
        {
          student_id,
          class_label,
          score, // percent 0-100
        },
      ])
      .select("id, created_at, score")
      .single();

    if (attemptErr || !attempt) {
      return res.status(500).json({
        ok: false,
        error: "Failed to create attempt",
        debug: attemptErr?.message,
      });
    }

    // 6) Ensure question_records table has needed columns (best-effort check by inserting)
    // Build insert rows for question_records
    const insertRows = qRows.map((r) => ({
      attempt_id: attempt.id,
      table_number: r.table_number,
      is_correct: r.is_correct,
    }));

    if (insertRows.length) {
      const { error: qrErr } = await supabaseAdmin
        .from("question_records")
        .insert(insertRows);

      if (qrErr) {
        // attempt is saved; question_records failed
        return res.status(500).json({
          ok: false,
          error: "Attempt saved, but failed to write question records",
          debug: qrErr.message,
          attempt,
          note: "This usually means question_records table is missing columns attempt_id/table_number/is_correct.",
        });
      }
    }

    return res.json({
      ok: true,
      attempt,
      score,
      correct: correctCount,
      total: totalCount,
      note:
        insertRows.length === 0
          ? "Attempt saved, but no question_records inserted (payload shape did not include enough info to infer correctness/table)."
          : "Attempt and question_records saved.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
