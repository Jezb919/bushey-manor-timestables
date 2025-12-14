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

    // Optional timing info from the browser (if you send it)
    const started_at_input = body.started_at || body.startedAt || null;
    const finished_at_input = body.finished_at || body.finishedAt || null;
    const avg_response_time_ms_input =
      body.avg_response_time_ms || body.avgResponseTimeMs || null;

    if (!first_name || !class_label) {
      return res.status(400).json({ error: "Missing name or class" });
    }

    // 1) Find student by first_name + class_label
    const { data: existingStudent, error: findErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, class_label")
      .eq("first_name", first_name)
      .eq("class_label", class_label)
      .maybeSingle();

    if (findErr) {
      return res.status(500).json({
        error: "Error checking student",
        details: findErr.message,
      });
    }

    let student = existingStudent;

    // 2) Create student if missing
    if (!student) {
      const { data: createdStudent, error: createErr } = await supabaseAdmin
        .from("students")
        .insert([{ first_name, class_label }])
        .select("id, first_name, class_label")
        .single();

      if (createErr) {
        return res.status(500).json({
          error: "Could not create student",
          details: createErr.message,
        });
      }

      student = createdStudent;
    }

    // 3) Build attempt row matching your attempts table columns
    const nowIso = new Date().toISOString();
    const started_at = started_at_input || nowIso;
    const finished_at = finished_at_input || nowIso;

    const percentage = total > 0 ? Math.round((score / total) * 1000) / 10 : 0; // 1dp
    const completed = true;

    const avg_response_time_ms = Number.isFinite(Number(avg_response_time_ms_input))
      ? Number(avg_response_time_ms_input)
      : null;

    const attemptRow = {
      student_id: student.id,        // UUID
      class_label: class_label,      // text
      started_at,
      finished_at,
      score,
      total,
      percentage,
      avg_response_time_ms,
      completed,
    };

    const { data: attempt, error: attemptErr } = await supabaseAdmin
      .from("attempts")
      .insert([attemptRow])
      .select("*")
      .single();

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
