// pages/api/teacher/heatmap.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    const {
      scope = "class", // class | year | school | student
      class_label,
      year,
      student_id,
      days = 30,
    } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    /* ---------------- STUDENTS ---------------- */
    let studentsQuery = supabase
      .from("students")
      .select("id, first_name, class_label");

    if (scope === "class" && class_label) {
      studentsQuery = studentsQuery.eq("class_label", class_label);
    }

    if (scope === "year" && year) {
      studentsQuery = studentsQuery.ilike("class_label", `%${year}`);
    }

    if (scope === "student" && student_id) {
      studentsQuery = studentsQuery.eq("id", student_id);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return res.status(400).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    const studentIds = (students || []).map((s) => s.id);

    /* ---------------- QUESTION RECORDS ---------------- */
    let qrQuery = supabase
      .from("question_records")
      .select("*")
      .gte("created_at", since.toISOString());

    if (studentIds.length > 0) {
      qrQuery = qrQuery.in("student_id", studentIds);
    } else {
      qrQuery = qrQuery.limit(0);
    }

    const { data: records, error: qrError } = await qrQuery;

    if (qrError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load question records",
        details: qrError.message,
      });
    }

    /* ---------------- HEATMAP (1–19) ---------------- */
    const tableHeat = Array.from({ length: 19 }).map((_, i) => ({
      table_num: i + 1,
      total: 0,
      correct: 0,
      accuracy: null,
    }));

    for (const r of records || []) {
      const tableNum =
        r.table_num ??
        r.table ??
        r.multiplier ??
        r.times_table;

      if (!tableNum || tableNum < 1 || tableNum > 19) continue;

      const isCorrect =
        r.is_correct ??
        r.was_correct ??
        r.correct ??
        false;

      const cell = tableHeat[tableNum - 1];
      cell.total += 1;
      if (isCorrect) cell.correct += 1;
    }

    for (const cell of tableHeat) {
      cell.accuracy =
        cell.total > 0
          ? Math.round((cell.correct / cell.total) * 100)
          : null;
    }

    return res.status(200).json({
      ok: true,
      scope,
      class_label: class_label ?? null,
      year: year ? Number(year) : null,
      student_id: student_id ?? null,
      days: Number(days),
      students,
      tableHeat,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
