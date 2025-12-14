import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normaliseClassLabel(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normaliseName(value) {
  return String(value || "").trim();
}

// Try these possible column names for class in the students table
const CLASS_COLS = ["class_label", "class_name", "class", "last_name"];

async function findStudent(first_name, class_label) {
  // Try each possible class column until one works
  for (const col of CLASS_COLS) {
    const { data, error } = await supabaseAdmin
      .from("students")
      .select(`id, first_name, ${col}`)
      .eq("first_name", first_name)
      .eq(col, class_label)
      .maybeSingle();

    if (!error) {
      return { student: data, classCol: col };
    }

    // If column doesn't exist, try next one. Otherwise return the real error.
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes(`column students.${col} does not exist`)) {
      continue;
    }
    return { student: null, classCol: null, error };
  }

  return {
    student: null,
    classCol: null,
    error: new Error(
      `Could not find a class column in students. Tried: ${CLASS_COLS.join(", ")}`
    ),
  };
}

async function createStudent(first_name, class_label, classCol) {
  // If we know which class column exists, insert into that.
  // Otherwise default to class_label.
  const col = classCol || "class_label";

  const payload = { first_name, [col]: class_label };

  const { data, error } = await supabaseAdmin
    .from("students")
    .insert([payload])
    .select("id, first_name")
    .single();

  return { data, error, usedCol: col };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};

    const first_name = normaliseName(body.name || body.first_name);
    const class_label = normaliseClassLabel(
      body.className || body.class || body.class_label || body.class_name
    );

    const score = Number.isFinite(Number(body.score)) ? Number(body.score) : 0;
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : 0;

    const started_at = body.started_at ?? body.startedAt ?? null;
    const finished_at = body.finished_at ?? body.finishedAt ?? null;

    const questions = Array.isArray(body.questions) ? body.questions : [];
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!first_name || !class_label) {
      return res.status(400).json({ error: "Missing name or class" });
    }

    // 1) Find student
    const found = await findStudent(first_name, class_label);

    if (found.error) {
      console.error("Error checking student:", found.error);
      return res.status(500).json({
        error: "Error checking student",
        details: found.error.message || String(found.error),
      });
    }

    let student = found.student;
    let classCol = found.classCol;

    // 2) Create if missing
    if (!student) {
      const created = await createStudent(first_name, class_label, classCol);

      if (created.error) {
        console.error("Could not create student:", created.error);
        return res.status(500).json({
          error: "Could not create student",
          details: created.error.message || String(created.error),
        });
      }

      student = created.data;
      classCol = created.usedCol;
    }

    // 3) Save attempt
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const nowIso = new Date().toISOString();

    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([
        {
          student_id: student.id,
          class_label,
          started_at: started_at || nowIso,
          finished_at: finished_at || nowIso,
          score,
          total,
          percent,
          completed: true,
        },
      ])
      .select("*")
      .single();

    if (attemptErr) {
      console.error("Could not save attempt:", attemptErr);
      return res.status(500).json({
        error: "Could not save attempt",
        details: attemptErr.message,
      });
    }

    // 4) Save per-question records (advanced)
    if (questions.length && answers.length && questions.length === answers.length) {
      const rows = questions.map((q, i) => {
        const a = Number(q.a);
        const b = Number(q.b);
        const correct_answer = Number(q.correct);

        const givenAnswer = answers[i]?.givenAnswer;
        const given_answer =
          givenAnswer === null || givenAnswer === undefined || givenAnswer === ""
            ? null
            : Number(givenAnswer);

        const is_correct = Boolean(answers[i]?.isCorrect);
        const response_time_ms = Number.isFinite(Number(answers[i]?.responseTimeMs))
          ? Number(answers[i]?.responseTimeMs)
          : null;

        return {
          attempt_id: attempt.id,
          student_id: student.id,
          question_index: i + 1,
          a,
          b,
          table_num: b,
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
        console.error("question_records insert failed:", qrErr);
        return res.status(200).json({
          ok: true,
          student,
          attempt,
          warning: "Attempt saved but question_records failed",
          details: qrErr.message,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      student,
      attempt,
      meta: { usedStudentClassColumn: classCol },
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
