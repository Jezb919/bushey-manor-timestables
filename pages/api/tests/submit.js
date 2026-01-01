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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { test_type, started_at, finished_at, answers:[{a,b,table_number,given_answer,correct_answer,is_correct,response_time_ms}] }",
      });
    }

    // --- Require student session cookie ---
    const cookies = parseCookies(req.headers.cookie || "");
    const raw = cookies.bmtt_student;
    if (!raw) return res.status(401).json({ ok: false, error: "Not signed in" });

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      return res.status(401).json({ ok: false, error: "Invalid session cookie" });
    }

    const studentId = session.studentId || session.student_id;
    const classLabel = session.class_label || session.classLabel || null;

    if (!studentId) {
      return res.status(400).json({ ok: false, error: "Missing studentId in session" });
    }
    if (!classLabel) {
      return res.status(400).json({ ok: false, error: "Missing class_label in session" });
    }

    const { test_type, started_at, finished_at, answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ ok: false, error: "answers[] is required" });
    }

    const startedAt = started_at ? new Date(started_at) : new Date();
    const finishedAt = finished_at ? new Date(finished_at) : new Date();

    // --- Compute score + avg response time ---
    const maxScore = answers.length;
    const score = answers.reduce((acc, x) => acc + (x?.is_correct ? 1 : 0), 0);
    const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;

    const responseTimes = answers
      .map((x) => Number(x?.response_time_ms))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : null;

    const supabase = getSupabaseAdmin();

    // --- Insert attempt (your table is "attempts") ---
    const attemptInsert = {
      student_id: studentId,
      class_label: classLabel,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      score,
      max_score: maxScore,
      percent,
      avg_response_time_ms: avgResponseTimeMs,
      completed: true,
      total: maxScore,
    };

    // If your attempts table requires test_config_id and it is NOT nullable,
    // you MUST set it here. If it IS nullable, leaving undefined is fine.
    // attemptInsert.test_config_id = null;

    const { data: attemptRow, error: attemptErr } = await supabase
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

    const attemptId = attemptRow.id;

    // --- Insert per-question rows (question_records) ---
    const qRows = answers.map((x, i) => ({
      attempt_id: attemptId,
      student_id: studentId,
      question_index: Number.isFinite(x.question_index) ? x.question_index : i,
      a: Number(x.a),
      b: Number(x.b),
      table_num: Number(x.table_number ?? x.table_num ?? x.tableNumber ?? x.tableNum ?? x.a),
      correct_answer: Number(x.correct_answer),
      given_answer: x.given_answer === "" || x.given_answer == null ? null : Number(x.given_answer),
      is_correct: !!x.is_correct,
      response_time_ms: Number.isFinite(Number(x.response_time_ms)) ? Number(x.response_time_ms) : null,
    }));

    const { error: qErr } = await supabase.from("question_records").insert(qRows);

    if (qErr) {
      // We keep the attempt, but tell you questions failed.
      return res.status(200).json({
        ok: true,
        attempt: attemptRow,
        warning: "Attempt saved but question_records insert failed",
        debug: qErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      attempt: attemptRow,
      info: "Saved attempt + question records",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
