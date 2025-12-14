import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const {
      name,
      className,
      score,
      total,
      questionTime,
      tablesUsed,
      questions,
    } = req.body || {};

    if (!name || !className) {
      return res.status(400).json({ ok: false, error: "Missing name/className" });
    }

    const firstName = String(name).trim();
    const classText = String(className).trim();

    // 1) find existing student (first_name + last_name) OR create new
    const { data: existing, error: selectErr } = await supabase
      .from("students")
      .select("id")
      .eq("first_name", firstName)
      .eq("last_name", classText)
      .maybeSingle();

    if (selectErr) {
      return res.status(500).json({ ok: false, error: selectErr.message });
    }

    let studentId = existing?.id;

    if (!studentId) {
      const { data: inserted, error: insertErr } = await supabase
        .from("students")
        .insert({ first_name: firstName, last_name: classText })
        .select("id")
        .single();

      if (insertErr) {
        return res.status(500).json({ ok: false, error: insertErr.message });
      }
      studentId = inserted.id;
    }

    // 2) insert test summary
    const percentage = total ? (Number(score) / Number(total)) * 100 : 0;

    const { data: testRow, error: testErr } = await supabase
      .from("tests")
      .insert([
        {
          student_id: studentId,
          score: Number(score) || 0,
          total: Number(total) || 0,
          percentage,
          tables_used: tablesUsed || [],
          question_time: Number(questionTime) || 6,
        },
      ])
      .select("id")
      .single();

    if (testErr) {
      return res.status(500).json({ ok: false, error: testErr.message });
    }

    // 3) insert test questions
    if (Array.isArray(questions) && questions.length > 0) {
      const rows = questions.map((q) => ({
        test_id: testRow.id,
        a: q.a,
        b: q.b,
        correct_answer: q.correct_answer,
        student_answer: q.student_answer,
        was_correct: q.was_correct,
      }));

      const { error: qErr } = await supabase.from("test_questions").insert(rows);
      if (qErr) {
        return res.status(500).json({ ok: false, error: qErr.message });
      }
    }

    return res.status(200).json({ ok: true, testId: testRow.id, studentId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

