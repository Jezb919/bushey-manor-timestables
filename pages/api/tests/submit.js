// pages/api/tests/submit.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normaliseClassLabel(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normaliseName(value) {
  return String(value || "").trim();
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

    if (!first_name || !class_label) {
      return res.status(400).json({ error: "Missing name or class" });
    }

    // 1) Find or create student (students.first_name + students.class_label)
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

    // 2) Save attempt (your schema differs, so we try several column patterns)
    const nowIso = new Date().toISOString();
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    const tryInsert = async (row) => {
      const { data, error } = await supabaseAdmin
        .from("attempts")
        .insert([row])
        .select("*")
        .single();
      return { data, error };
    };

    // Attempt A: columns like score/total/percentage/completed/finished_at
    let rowA = {
      student_id: student.id,
      class_label,
      score,
      total,
      percentage: percent,
      completed: true,
      finished_at: nowIso,
      started_at: nowIso,
    };

    let { data: attempt, error: attemptErr } = await tryInsert(rowA);

    // Attempt B: column is called "percent" not "percentage"
    if (attemptErr) {
      const rowB = {
        student_id: student.id,
        class_label,
        score,
        total,
        percent: percent,
        completed: true,
        finished_at: nowIso,
        started_at: nowIso,
      };

      const r2 = await tryInsert(rowB);
      attempt = r2.data;
      attemptErr = r2.error;
    }

    // Attempt C: some schemas use max_score/max_sc... — set max_score = total
    if (attemptErr) {
      const rowC = {
        student_id: student.id,
        class_label,
        score,
        total,
        max_score: total,
        percent: percent,
        completed: true,
        finished_at: nowIso,
        started_at: nowIso,
      };

      const r3 = await tryInsert(rowC);
      attempt = r3.data;
      attemptErr = r3.error;
    }

    // Attempt D (minimal): just save the essentials (this should always work)
    if (attemptErr) {
      const rowD = {
        student_id: student.id,
        class_label,
        score,
        total,
      };

      const r4 = await tryInsert(rowD);
      attempt = r4.data;
      attemptErr = r4.error;
    }

    if (attemptErr) {
      return res.status(500).json({
        error: "Could not save attempt",
        details: attemptErr.message,
      });
    }

    return res.status(200).json({ ok: true, student, attempt });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
