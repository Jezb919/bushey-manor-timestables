// pages/api/student/settings.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function normaliseClassLabel(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const classLabel = normaliseClassLabel(req.query?.class_label);

    if (!classLabel) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    // 1) Find the class row
    const { data: cls, error: classErr } = await supabase
      .from("classes")
      .select("id, class_label, year_group")
      .eq("class_label", classLabel)
      .maybeSingle();

    if (classErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load classes",
        details: classErr.message,
      });
    }

    if (!cls) {
      return res.status(404).json({
        ok: false,
        error: `Class not found: ${classLabel}`,
      });
    }

    // 2) Find a teacher assigned to this class (teacher_classes uses class_id)
    const { data: tc, error: tcErr } = await supabase
      .from("teacher_classes")
      .select("teacher_id")
      .eq("class_id", cls.id)
      .limit(1);

    if (tcErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to read teacher_classes",
        details: tcErr.message,
      });
    }

    const teacherId = tc?.[0]?.teacher_id || null;

    // Default settings if no teacher assignment/settings yet
    const defaults = {
      question_count: 25,
      seconds_per_question: 6,
      tables_selected: Array.from({ length: 19 }, (_, i) => i + 1),
    };

    if (!teacherId) {
      return res.status(200).json({
        ok: true,
        class_label: cls.class_label,
        year_group: cls.year_group,
        source: "defaults_no_teacher_assigned",
        settings: { ...defaults, class_label: cls.class_label },
      });
    }

    // 3) Pull that teacher’s saved settings for this class
    const { data: settingsRow, error: sErr } = await supabase
      .from("teacher_settings")
      .select("question_count, seconds_per_question, tables_selected, class_label, updated_at")
      .eq("teacher_id", teacherId)
      .eq("class_label", classLabel)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (sErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load teacher_settings",
        details: sErr.message,
      });
    }

    if (!settingsRow) {
      return res.status(200).json({
        ok: true,
        class_label: cls.class_label,
        year_group: cls.year_group,
        source: "defaults_no_settings_row",
        settings: { ...defaults, class_label: cls.class_label },
      });
    }

    return res.status(200).json({
      ok: true,
      class_label: cls.class_label,
      year_group: cls.year_group,
      source: "teacher_settings",
      settings: {
        class_label,
        question_count: settingsRow.question_count ?? defaults.question_count,
        seconds_per_question:
          settingsRow.seconds_per_question ?? defaults.seconds_per_question,
        tables_selected:
          settingsRow.tables_selected ?? defaults.tables_selected,
        updated_at: settingsRow.updated_at ?? null,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
