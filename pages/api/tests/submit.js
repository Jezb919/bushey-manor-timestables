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

function isoNow() {
  return new Date().toISOString();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info:
          "Send JSON: { started_at, finished_at, answers:[{a,b,table_number,given_answer,correct_answer,is_correct,response_time_ms}] }",
      });
    }

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
    const classId = session.class_id || null;

    if (!studentId) {
      return res.status(400).json({ ok: false, error: "Missing studentId in session" });
    }
    if (!classId) {
      return res.status(400).json({ ok: false, error: "Missing class_id in session" });
    }

    const { started_at, finished_at, answers } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ ok: false, error: "answers[] is required" });
    }

    const startedAtIso = started_at ? new Date(started_at).toISOString() : isoNow();
    const finishedAtIso = finished_at ? new Date(finished_at).toISOString() : isoNow();

    // Score
    const maxScore = answers.length;
    const score = answers.reduce((acc, x) => acc + (x?.is_correct ? 1 : 0), 0);
    const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;

    const responseTimes = answers
      .map((x) => num(x?.response_time_ms, 0))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const avgResponseTimeMs =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    const supabase = getSupabaseAdmin();

    // ✅ Look up class_label from classes using class_id
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("class_label")
      .eq("id", classId)
      .maybeSingle();

    if (clsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load class",
        debug: clsErr.message,
      });
    }

    const classLabel = cls?.class_label || null;

    // Insert attempt
    const attemptInsert = {
      student_id: studentId,
      class_label: classLabel, // may be null, but we tried to fetch it
      started_at: startedAtIso,
      finished_at: finishedAtIso,
      score,
      max_score: maxScore,
      percent,
      avg_response_time_ms: avgResponseTimeMs,
      completed: true,
      total: maxScore,
      created_at: isoNow(),
    };

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

    // Insert question rows
    const createdAt = isoNow();
    const qRows = answers.map((x, i) => {
      const a = num(x.a, 0);
      const b = num(x.b, 0);

      const tableNumber = num(
        x.table_number ?? x.table_num ?? x.tableNumber ?? x.tableNum ?? a,
        a
      );
      const correctAnswer = num(x.correct_answer ?? a * b, a * b);

      const givenRaw = x.given_answer;
      const givenAnswer =
        givenRaw === "" || givenRaw === null || givenRaw === undefined
          ? null
          : num(givenRaw, 0);

      return {
        attempt_id: attemptId,
        student_id: studentId,
        question_index: Number.isFinite(num(x.question_index, i)) ? num(x.question_index, i) : i,
        a,
        b,
        table_num: tableNumber,
        table_number: tableNumber,
        correct_answer: correctAnswer,
        given_answer: givenAnswer,
        is_correct: !!x.is_correct,
        response_time_ms: num(x.response_time_ms, 0),
        created_at: createdAt,
      };
    });

    const { error: qErr } = await supabase.from("question_records").insert(qRows);

    if (qErr) {
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
      inserted_questions: qRows.length,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
