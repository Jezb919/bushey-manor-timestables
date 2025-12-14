import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Runs ONLY on the server (safe in /api)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = req.body || {};

    // Frontend sometimes sends class or className — accept either
    const first_name = String(body.name || body.first_name || "").trim();
    const class_name = String(body.className || body.class || body.class_name || "").trim();

    const score = Number.isFinite(Number(body.score)) ? Number(body.score) : 0;
    const total = Number.isFinite(Number(body.total)) ? Number(body.total) : 0;

    // optional extra info if you send it later
    const answers = body.answers ?? null;
    const settings = body.settings ?? null;
    const started_at = body.started_at ?? body.startedAt ?? null;
    const finished_at = body.finished_at ?? body.finishedAt ?? null;

    if (!first_name || !class_name) {
      return res.status(400).json({ error: "Missing name or className" });
    }

    // 1) Find existing student by first_name + class_name
    const { data: existingStudent, error: findErr } = await supabaseAdmin
      .from("students")
      .select("id, student_id, first_name, class_name")
      .eq("first_name", first_name)
      .eq("class_name", class_name)
      .maybeSingle();

    if (findErr) {
      return res.status(500).json({ error: "Error checking student", details: findErr.message });
    }

    let student = existingStudent;

    // 2) Create student if missing
    if (!student) {
      const { data: createdStudent, error: createErr } = await supabaseAdmin
        .from("students")
        .insert([{ first_name, class_name }])
        .select("id, student_id, first_name, class_name")
        .single();

      if (createErr) {
        return res.status(500).json({ error: "Could not create student", details: createErr.message });
      }

      student = createdStudent;
    }

    // 3) Save attempt
    // IMPORTANT: This assumes attempts.student_id is an int that matches students.student_id
    const attemptRow = {
      student_id: student.student_id,
      score,
      total,
      answers,
      settings,
      started_at,
      finished_at,
    };

    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([attemptRow])
      .select("*")
      .single();

    if (attemptErr) {
      return res.status(500).json({ error: "Could not save attempt", details: attemptErr.message });
    }

    return res.status(200).json({ ok: true, student, attempt });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}
