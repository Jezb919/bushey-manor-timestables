import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getStudentSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies.bmtt_student;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info:
          "Send JSON: { answers: [{a,b,given_answer,response_time_ms,question_index?,table_number?}], started_at?, finished_at? }",
      });
    }

    const session = getStudentSession(req);
    if (!session?.studentId && !session?.student_id) {
      return res.status(401).json({ ok: false, error: "Not signed in" });
    }

    const student_id = session.studentId || session.student_id;
    const class_id = session.class_id || null;
    const class_label = session.class_label || null;

    const body = req.body || {};
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!answers.length) {
      return res
        .status(400)
        .json({ ok: false, error: "No answers received" });
    }

    const started_at = body.started_at || nowIso();
    const finished_at = body.finished_at || nowIso();

    // Recompute correctness server-side (don’t trust browser)
    const normalized = answers.map((q, idx) => {
      const a = toInt(q.a, 0);
      const b = toInt(q.b, 0);

      // allow different field names coming from the front-end
      const given =
        q.given_answer ?? q.givenAnswer ?? q.answer ?? q.given ?? null;
      const given_answer = given === "" || given === null ? null : toInt(given);

      const correct_answer = a * b;
      const is_correct = given_answer !== null && given_answer === correct_answer;

      const response_time_ms = toInt(q.response_time_ms ?? q.responseTimeMs, 0);

      // question index
      const question_index =
        q.question_index ?? q.questionIndex ?? idx;

      // table number: prefer explicit value from client, else use the "table factor"
      const table_number =
        q.table_number ?? q.tableNumber ?? q.table_num ?? q.tableNum ?? a;

      return {
        student_id,
        question_index: toInt(question_index, idx),
        a,
        b,
        table_number: toInt(table_number, a),
        table_num: toInt(table_number, a), // for compatibility if your DB uses table_num
        correct_answer,
        given_answer,
        is_correct,
        response_time_ms,
        created_at: nowIso(),
      };
    });

    const score = normalized.reduce((acc, q) => acc + (q.is_correct ? 1 : 0), 0);
    const total = normalized.length;
    const max_score = total;
    const percent = total > 0 ? (score / total) * 100 : 0;

    const avg_response_time_ms =
      total > 0
        ? Math.round(
            normalized.reduce((acc, q) => acc + (q.response_time_ms || 0), 0) /
              total
          )
        : 0;

    const supabase = getSupabaseAdmin();

    // Insert attempt summary into your "attempts" table
    const attemptInsert = {
      student_id,
      class_label: class_label || null,
      started_at,
      finished_at,
      score,
      max_score,
      percent,
      avg_response_time_ms,
      completed: true,
      total,
      created_at: nowIso(),
    };

    // If your schema has test_config_id, allow it but don’t require it
    if (body.test_config_id || body.testConfigId) {
      attemptInsert.test_config_id = body.test_config_id || body.testConfigId;
    }

    const { data: attempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert(attemptInsert)
      .select("*")
      .single();

    if (attemptErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to save attempt",
        debug: attemptErr.message,
      });
    }

    // Insert per-question rows into question_records
    const attempt_id = attempt.id;

    const questionRows = normalized.map((q) => ({
      attempt_id,
      student_id: q.student_id,
      question_index: q.question_index,
      a: q.a,
      b: q.b,
      table_number: q.table_number, // your table shows this exists
      table_num: q.table_num,       // your table also shows this exists
      correct_answer: q.correct_answer,
      given_answer: q.given_answer,
      is_correct: q.is_correct,
      response_time_ms: q.response_time_ms,
      created_at: nowIso(),
    }));

    const { error: qErr } = await supabase
      .from("question_records")
      .insert(questionRows);

    if (qErr) {
      // Attempt saved, but questions failed (still return attempt so teacher dashboard can work)
      return res.status(200).json({
        ok: true,
        warning: "Attempt saved but question rows failed",
        attempt,
        debug: qErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      attempt,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
