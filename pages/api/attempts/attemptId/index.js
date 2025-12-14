import { createClient } from "@supabase/supabase-js";

// IMPORTANT:
// - Uses your Vercel env vars (server-side).
// - Do NOT put keys directly in this file.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // This will show in Vercel logs if env vars are missing.
  console.error(
    "Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Simple UUID check (so we only use attemptId as an ID if it's actually a UUID)
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

export default async function handler(req, res) {
  const { attemptId } = req.query;

  // Allow only POST for saving attempts
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    // Expecting body from the test page
    // name + className are required.
    const {
      name,
      className,
      score,
      total,
      answers, // optional (array or object)
      settings, // optional (e.g. tables, time per q, etc.)
      startedAt,
      finishedAt,
    } = req.body || {};

    const safeName = String(name || "").trim();
    const safeClass = String(className || "").trim();

    if (!safeName || !safeClass) {
      return res.status(400).json({
        error: "Missing name or className",
      });
    }

    // 1) Find student (uses your real columns)
    // students table MUST have: first_name (text) and class_name (text)
    // (You already created class_name.)
    const { data: existingStudent, error: studentFindError } =
      await supabaseAdmin
        .from("students")
        .select("id, student_id, first_name, class_name")
        .eq("first_name", safeName)
        .eq("class_name", safeClass)
        .maybeSingle();

    if (studentFindError) {
      console.error("Error checking student:", studentFindError);
      return res.status(500).json({
        error: "Error checking student",
        details: studentFindError.message,
      });
    }

    let student = existingStudent;

    // 2) Create student if not found
    if (!student) {
      const { data: newStudent, error: studentInsertError } =
        await supabaseAdmin
          .from("students")
          .insert([
            {
              first_name: safeName,
              class_name: safeClass,
            },
          ])
          .select("id, student_id, first_name, class_name")
          .single();

      if (studentInsertError) {
        console.error("Error creating student:", studentInsertError);
        return res.status(500).json({
          error: "Could not create student",
          details: studentInsertError.message,
        });
      }

      student = newStudent;
    }

    // 3) Save attempt
    //
    // This assumes you have an "attempts" table with (at minimum) these columns:
    // - id (uuid, default uuid)
    // - student_id (int4)  OR student_uuid (uuid) — we try student_id first
    // - score (int)
    // - total (int)
    // - created_at (timestamp, default now())
    // Optional but recommended:
    // - answers (jsonb)
    // - settings (jsonb)
    // - started_at (timestamptz)
    // - finished_at (timestamptz)
    //
    // If your attempts table uses a DIFFERENT name, tell me the exact table name.
    const attemptRow = {
      // prefer int student_id if it exists
      student_id: student.student_id ?? null,

      // also store uuid id if you want later (safe if column exists; if not, remove it)
      student_uuid: student.id,

      score: Number.isFinite(Number(score)) ? Number(score) : 0,
      total: Number.isFinite(Number(total)) ? Number(total) : 0,

      // these only work if the columns exist as jsonb/timestamptz
      answers: answers ?? null,
      settings: settings ?? null,
      started_at: startedAt ?? null,
      finished_at: finishedAt ?? null,
    };

    // If attemptId is a real UUID, we’ll store it as the attempt ID.
    // If not, we let Supabase create one automatically.
    if (isUuid(attemptId)) {
      attemptRow.id = attemptId;
    }

    const { data: savedAttempt, error: attemptInsertError } =
      await supabaseAdmin
        .from("attempts")
        .insert([attemptRow])
        .select("*")
        .single();

    if (attemptInsertError) {
      console.error("Error saving attempt:", attemptInsertError);
      return res.status(500).json({
        error: "Could not save attempt",
        details: attemptInsertError.message,
      });
    }

    // Done
    return res.status(200).json({
      ok: true,
      student,
      attempt: savedAttempt,
    });
  } catch (err) {
    console.error("API crash:", err);
    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
