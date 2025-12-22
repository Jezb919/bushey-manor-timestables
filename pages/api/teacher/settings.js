// pages/api/teacher/settings.js
import { createClient } from "@supabase/supabase-js";

/**
 * Uses Service Role because this is a server API route.
 * Auth is handled via a teacher session cookie.
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * If you used a different cookie name in your login route, set:
 * TEACHER_SESSION_COOKIE=bmtt_teacher_session_v1 (or whatever yours is)
 */
const COOKIE_NAME = process.env.TEACHER_SESSION_COOKIE || "bmtt_teacher_session";

/** very small helper */
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function normaliseClassLabel(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function normaliseTablesSelected(value) {
  // Accept: array of numbers, or comma string "1,2,3"
  if (Array.isArray(value)) {
    return value
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 19);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 19);
  }
  return [];
}

function safeInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function getLoggedInTeacher(req) {
  // We expect the cookie value to be the teacher UUID.
  // (That matches your /api/teacher/me behaviour where loggedIn becomes true/false.)
  const cookieVal = req.cookies?.[COOKIE_NAME];

  if (!cookieVal) return null;
  if (!isUuid(cookieVal)) return null;

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, email, full_name, role")
    .eq("id", cookieVal)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return teacher || null;
}

export default async function handler(req, res) {
  try {
    const teacher = await getLoggedInTeacher(req);

    if (!teacher) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // GET:
    //  - /api/teacher/settings                 -> returns settings for all teacher classes (if stored)
    //  - /api/teacher/settings?class_label=M4  -> returns settings for that class
    if (req.method === "GET") {
      const classLabel = req.query?.class_label
        ? normaliseClassLabel(req.query.class_label)
        : null;

      let q = supabase
        .from("teacher_settings")
        .select(
          "teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at"
        )
        .eq("teacher_id", teacher.id);

      if (classLabel) q = q.eq("class_label", classLabel);

      const { data, error } = await q.order("updated_at", { ascending: false });

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load teacher_settings",
          details: error.message,
        });
      }

      // Provide a sane default if nothing saved yet
      const defaultSettings = {
        question_count: 25,
        seconds_per_question: 6,
        tables_selected: Array.from({ length: 19 }, (_, i) => i + 1),
      };

      if (!data || data.length === 0) {
        return res.status(200).json({
          ok: true,
          loggedIn: true,
          teacher,
          class_label: classLabel,
          settings: classLabel ? { ...defaultSettings, class_label: classLabel } : null,
          settingsByClass: classLabel ? null : [],
          note:
            "No saved settings yet for this teacher. Returning defaults (25 questions, 6 seconds, tables 1–19).",
        });
      }

      if (classLabel) {
        // take most recent row
        const row = data[0];
        return res.status(200).json({
          ok: true,
          loggedIn: true,
          teacher,
          class_label: classLabel,
          settings: {
            class_label: row.class_label,
            question_count: row.question_count ?? defaultSettings.question_count,
            seconds_per_question:
              row.seconds_per_question ?? defaultSettings.seconds_per_question,
            tables_selected:
              row.tables_selected ?? defaultSettings.tables_selected,
            updated_at: row.updated_at ?? null,
          },
        });
      }

      // all classes
      const settingsByClass = data.map((row) => ({
        class_label: row.class_label,
        question_count: row.question_count ?? defaultSettings.question_count,
        seconds_per_question:
          row.seconds_per_question ?? defaultSettings.seconds_per_question,
        tables_selected: row.tables_selected ?? defaultSettings.tables_selected,
        updated_at: row.updated_at ?? null,
      }));

      return res.status(200).json({
        ok: true,
        loggedIn: true,
        teacher,
        settingsByClass,
      });
    }

    // POST:
    // body: { class_label, question_count, seconds_per_question, tables_selected }
    // Saves settings for THIS teacher + THIS class_label.
    if (req.method === "POST") {
      const body = req.body || {};

      const class_label = normaliseClassLabel(body.class_label);
      const question_count = safeInt(body.question_count, 25);
      const seconds_per_question = safeInt(body.seconds_per_question, 6);
      const tables_selected = normaliseTablesSelected(body.tables_selected);

      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      if (question_count < 1 || question_count > 120) {
        return res.status(400).json({
          ok: false,
          error: "question_count must be between 1 and 120",
        });
      }

      if (seconds_per_question < 1 || seconds_per_question > 60) {
        return res.status(400).json({
          ok: false,
          error: "seconds_per_question must be between 1 and 60",
        });
      }

      if (!tables_selected.length) {
        return res.status(400).json({
          ok: false,
          error: "Select at least 1 table (1–19)",
        });
      }

      const row = {
        teacher_id: teacher.id,
        class_label,
        question_count,
        seconds_per_question,
        tables_selected,
        updated_at: new Date().toISOString(),
      };

      // Upsert on (teacher_id, class_label)
      const { data, error } = await supabase
        .from("teacher_settings")
        .upsert(row, { onConflict: "teacher_id,class_label" })
        .select(
          "teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at"
        )
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to save settings",
          details: error.message,
          hint:
            "If this mentions onConflict, you need a UNIQUE constraint on (teacher_id, class_label).",
        });
      }

      return res.status(200).json({ ok: true, saved: data });
    }

    return res.status(405).json({ ok: false, error: "Use GET or POST" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
