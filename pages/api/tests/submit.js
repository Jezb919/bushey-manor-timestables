import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const student_id = body.student_id || body.studentId;
    const answers = body.answers || body.results || [];
    const class_label = body.class_label || body.classLabel || null;

    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ ok: false, error: "Missing answers[]" });
    }

    // answers[] should look like:
    // { a: 7, b: 4, user_answer: 28, correct_answer: 28, table_number: 7 }
    const total = answers.length;
    let correct = 0;

    for (const q of answers) {
      const ua = Number(q.user_answer ?? q.userAnswer);
      const ca = Number(q.correct_answer ?? q.correctAnswer);
      if (!Number.isNaN(ua) && !Number.isNaN(ca) && ua === ca) correct += 1;
    }

    const score = Math.round((correct / total) * 100);

    // 1) Create attempt
    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([
        {
          student_id,
          class_label,
          score, // <- IMPORTANT: your system already uses "score"
        },
      ])
      .select("id, created_at, score")
      .single();

    if (attemptErr) {
      return res.status(500).json({ ok: false, error: "Failed to create attempt", debug: attemptErr.message });
    }

    // 2) Create question_records (one row per question)
    const qrRows = answers.map((q) => {
      const a = Number(q.a);
      const b = Number(q.b);
      const ua = Number(q.user_answer ?? q.userAnswer);
      const ca = Number(q.correct_answer ?? q.correctAnswer);

      // If table_number not supplied, infer from "a"
      const table_number = Number(q.table_number ?? q.tableNumber ?? a);

      const is_correct = !Number.isNaN(ua) && !Number.isNaN(ca) && ua === ca;

      return {
        attempt_id: attempt.id,
        table_number: Number.isFinite(table_number) ? table_number : null,
        is_correct,
      };
    });

    const { error: qrErr } = await supabaseAdmin
      .from("question_records")
      .insert(qrRows);

    if (qrErr) {
      // attempt exists, but question_records failed — return useful info
      return res.status(500).json({
        ok: false,
        error: "Attempt saved but failed to write question records",
        debug: qrErr.message,
        attempt,
      });
    }

    return res.json({
      ok: true,
      attempt,
      score,
      correct,
      total,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
