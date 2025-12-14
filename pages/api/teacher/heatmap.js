// pages/api/teacher/heatmap.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function inferYearFromClassLabel(label) {
  // Works for M4, B4, 4M etc (takes last number found)
  if (!label) return null;
  const m = String(label).match(/(\d+)/g);
  if (!m || !m.length) return null;
  return Number(m[m.length - 1]);
}

export default async function handler(req, res) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        ok: false,
        error:
          "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const {
      scope = "class", // class | year | school | student
      class_label,
      year,
      student_id,
      days = 30,
    } = req.query;

    const daysNum = clampInt(days, 30, 1, 365);

    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    /* ------------------ Load students for the scope ------------------ */

    let studentsQuery = supabase
      .from("students")
      .select("id, first_name, class_label");

    if (scope === "class") {
      if (!class_label) {
        return res.status(400).json({
          ok: false,
          error: "Missing class_label for scope=class",
        });
      }
      studentsQuery = studentsQuery.eq("class_label", String(class_label));
    }

    if (scope === "student") {
      if (!student_id) {
        return res.status(400).json({
          ok: false,
          error: "Missing student_id for scope=student",
        });
      }
      studentsQuery = studentsQuery.eq("id", String(student_id));
    }

    // scope=year and scope=school: we load all students, then filter in JS (safe + flexible)

    const { data: allStudents, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    let students = allStudents || [];

    if (scope === "year") {
      const yearNum = clampInt(year, NaN, 1, 13);
      if (!Number.isFinite(yearNum)) {
        return res.status(400).json({
          ok: false,
          error: "Missing/invalid year for scope=year (e.g. year=4)",
        });
      }

      students = students.filter((s) => inferYearFromClassLabel(s.class_label) === yearNum);
    }

    // scope=school: no filter

    const studentIds = students.map((s) => s.id);

    /* ------------------ Load question records ------------------ */
    // We rely on: question_records.student_id, question_records.table_num, question_records.is_correct, question_records.created_at

    let qrQuery = supabase
      .from("question_records")
      .select("student_id, table_num, is_correct, created_at")
      .gte("created_at", since.toISOString());

    if (scope !== "school") {
      if (!studentIds.length) {
        // No students matched (e.g. year filter but none exist)
        return res.status(200).json({
          ok: true,
          scope,
          class_label: class_label ?? null,
          year: year ? Number(year) : null,
          student_id: student_id ?? null,
          days: daysNum,
          students: students.map((s) => ({
            id: s.id,
            first_name: s.first_name,
            class_label: s.class_label,
          })),
          tableHeat: Array.from({ length: 19 }).map((_, i) => ({
            table_num: i + 1,
            total: 0,
            correct: 0,
            accuracy: null,
          })),
        });
      }

      qrQuery = qrQuery.in("student_id", studentIds);
    }

    const { data: records, error: qrError } = await qrQuery;

    if (qrError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to read question_records",
        details: qrError.message,
      });
    }

    /* ------------------ Build heatmap 1–19 ------------------ */

    const tableHeat = Array.from({ length: 19 }).map((_, i) => ({
      table_num: i + 1,
      total: 0,
      correct: 0,
      accuracy: null,
    }));

    for (const r of records || []) {
      const t = Number(r.table_num);
      if (!Number.isFinite(t) || t < 1 || t > 19) continue;

      const cell = tableHeat[t - 1];
      cell.total += 1;

      if (r.is_correct === true) {
        cell.correct += 1;
      }
    }

    for (const cell of tableHeat) {
      cell.accuracy = cell.total > 0 ? Math.round((cell.correct / cell.total) * 100) : null;
    }

    /* ------------------ Extra helpful meta ------------------ */

    let studentMeta = null;
    if (scope === "student") {
      const s = students[0];
      studentMeta = s
        ? { id: s.id, first_name: s.first_name, class_label: s.class_label }
        : null;
    }

    return res.status(200).json({
      ok: true,
      scope,
      class_label: class_label ?? null,
      year: year ? Number(year) : null,
      student_id: student_id ?? null,
      days: daysNum,
      student: studentMeta,
      students: students.map((s) => ({
        id: s.id,
        first_name: s.first_name,
        class_label: s.class_label,
      })),
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
