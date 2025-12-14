// pages/api/tests/submit.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};

    const first_name = String(body.name || "").trim();
    const class_label = String(body.className || body.class || "").trim();

    const score = Number(body.score ?? 0);
    const total = Number(body.total ?? 0);

    // These come from the test page:
    // questions: [{a,b,correct}]
    // answers: [{givenAnswer,isCorrect,responseTimeMs}]
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!first_name || !class_label) {
      return res.status(400).json({ error: "Missing name or class" });
    }

    // 1) Find or create student
    const { data: existingStudent, error: findErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, class_label")
      .eq("first_name", first_name)
      .eq("class_label", class_label)
      .maybeSingle();

    if (findErr) {
      return res.status(500).json({ error: "Error checking student", details: findErr.message });
    }

    let student = existingStudent;

    if (!student) {
      const { data: createdStudent, error: createErr } = await supabaseAdmin
        .from("students")
        .insert([{ first_name, class_label }])
        .select("id, first_name, class_label")
        .single();

      if (createErr) {
        return res.status(500).json({ error: "Could not create student", details: createErr.message });
      }
      student = createdStudent;
    }

    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const nowIso = new Date().toISOString();

    // 2) Create attempt row
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([{
        student_id: student.id,
        class_label,
        started_at: body.started_at || nowIso,
        finished_at: body.finished_at || nowIso,
        score,
        total,
        percent,
        completed: true,
      }])
      .select("*")
      .single();

    if (attemptErr) {
      return res.status(500).json({ error: "Could not save attempt", details: attemptErr.message });
    }

    // 3) Save per-question records (optional but recommended)
    // Only do this if we actually received question + answer arrays.
    if (questions.length && answers.length && questions.length === answers.length) {
      const rows = questions.map((q, i) => {
        const a = Number(q.a);
        const b = Number(q.b);
        const correct_answer = Number(q.correct);
        const given_answer =
          answers[i]?.givenAnswer === null || answers[i]?.givenAnswer === undefined || answers[i]?.givenAnswer === ""
            ? null
            : Number(answers[i]?.givenAnswer);

        const is_correct = Boolean(answers[i]?.isCorrect);
        const response_time_ms =
          answers[i]?.responseTimeMs === null || answers[i]?.responseTimeMs === undefined
            ? null
            : Number(answers[i]?.responseTimeMs);

        return {
          attempt_id: attempt.id,
          student_id: student.id,
          question_index: i + 1,
          a,
          b,
          table_num: b, // using "b" as the times-table number
          correct_answer,
          given_answer,
          is_correct,
          response_time_ms,
        };
      });

      const { error: qrErr } = await supabaseAdmin
        .from("question_records")
        .insert(rows);

      if (qrErr) {
        // We won't fail the whole request if question_records insert fails,
        // but we WILL tell you in the response so you can see it.
        return res.status(200).json({
          ok: true,
          student,
          attempt,
          warning: "Attempt saved but question_records failed",
          details: qrErr.message,
        });
      }
    }

    return res.status(200).json({ ok: true, student, attempt });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
