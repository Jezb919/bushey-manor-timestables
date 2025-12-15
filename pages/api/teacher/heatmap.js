// pages/api/teacher/heatmap.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const isUuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
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

    // Validate
    if (scope === "class" && !class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }
    if (scope === "year" && !year) {
      return res.status(400).json({ ok: false, error: "Missing year" });
    }
    if (scope === "student") {
      if (!student_id) {
        return res.status(400).json({ ok: false, error: "Missing student_id" });
      }
      if (!isUuid(student_id)) {
        return res
          .status(400)
          .json({ ok: false, error: "student_id must be a UUID" });
      }
    }

    // Load students for scope
    let studentsQuery = supabase.from("students").select("id, class_label");

    if (scope === "class") {
      studentsQuery = studentsQuery.eq("class_label", String(class_label).trim());
    } else if (scope === "year") {
      studentsQuery = studentsQuery.ilike("class_label", `%${String(year).trim()}`);
    } else if (scope === "student") {
      studentsQuery = studentsQuery.eq("id", student_id);
    }
    // scope=school -> no filter

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    const studentIds = (students || []).map((s) => s.id);

    // Load question_records
    let qrQuery = supabase
      .from("question_records")
      .select("student_id, table_num, is_correct, created_at")
      .gte("created_at", since.toISOString());

    if (scope !== "school") {
      if (studentIds.length === 0) {
        return res.status(200).json({
          ok: true,
          scope,
          class_label: class_label ?? null,
          year: year ? Number(year) : null,
          student_id: student_id ?? null,
          days: Number(days),
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

    // Build heatmap 1–19
    const tableHeat = Array.from({ length: 19 }).map((_, i) => ({
      table_num: i + 1,
      total: 0,
      correct: 0,
      accuracy: null,
    }));

    for (const r of records || []) {
      const tableNum = Number(r.table_num);
      if (!tableNum || tableNum < 1 || tableNum > 19) continue;

      const cell = tableHeat[tableNum - 1];
      cell.total += 1;
      if (r.is_correct === true) cell.correct += 1;
    }

    for (const cell of tableHeat) {
      cell.accuracy =
        cell.total > 0 ? Math.round((cell.correct / cell.total) * 100) : null;
    }

    return res.status(200).json({
      ok: true,
      scope,
      class_label: class_label ?? null,
      year: year ? Number(year) : null,
      student_id: student_id ?? null,
      days: Number(days),
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
