// pages/api/teacher/table_breakdown.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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
      table_num,
    } = req.query;

    const tnum = Number(table_num);

    // Validate table_num
    if (!Number.isFinite(tnum) || tnum < 1 || tnum > 19) {
      return res.status(400).json({
        ok: false,
        error: "Invalid table_num. Use 1–19 (e.g. table_num=6)",
      });
    }

    // Validate scope filters
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

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    /* ---------------- STUDENTS FOR THIS SCOPE ---------------- */
    let studentsQuery = supabase
      .from("students")
      .select("id, first_name, class_label");

    if (scope === "class") {
      studentsQuery = studentsQuery.eq(
        "class_label",
        String(class_label).trim()
      );
    } else if (scope === "year") {
      // Matches M4, B4 etc (anything ending in 4)
      studentsQuery = studentsQuery.ilike(
        "class_label",
        `%${String(year).trim()}`
      );
    } else if (scope === "student") {
      studentsQuery = studentsQuery.eq("id", student_id);
    }
    // scope === school -> no filter

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    const studentIds = (students || []).map((s) => s.id);

    // No students matched? Return empty breakdown (not an error)
    if (scope !== "school" && studentIds.length === 0) {
      return res.status(200).json({
        ok: true,
        scope,
        class_label: class_label ?? null,
        year: year ? Number(year) : null,
        student_id: student_id ?? null,
        days: Number(days),
        table_num: tnum,
        breakdown: [],
        summary: { total: 0, correct: 0, accuracy: null },
      });
    }

    /* ---------------- QUESTION RECORDS FOR THIS TABLE ---------------- */
    let qrQuery = supabase
      .from("question_records")
      .select("student_id, table_num, is_correct, created_at")
      .eq("table_num", tnum)
      .gte("created_at", since.toISOString());

    if (scope !== "school") {
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

    /* ---------------- AGGREGATE PER STUDENT ---------------- */
    const byStudent = new Map();

    for (const r of records || []) {
      const sid = r.student_id;
      if (!sid) continue;

      const cur = byStudent.get(sid) || { total: 0, correct: 0 };
      cur.total += 1;
      if (r.is_correct === true) cur.correct += 1;
      byStudent.set(sid, cur);
    }

    const breakdown = (students || []).map((s) => {
      const agg = byStudent.get(s.id) || { total: 0, correct: 0 };
      const accuracy =
        agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : null;

      return {
        student_id: s.id,
        student: s.first_name,
        class_label: s.class_label,
        total: agg.total,
        correct: agg.correct,
        accuracy,
      };
    });

    // Sort: lowest accuracy first (so “intervention” is at top)
    breakdown.sort((a, b) => {
      const ap = typeof a.accuracy === "number" ? a.accuracy : 101;
      const bp = typeof b.accuracy === "number" ? b.accuracy : 101;
      if (ap !== bp) return ap - bp;
      return (b.total || 0) - (a.total || 0);
    });

    // Summary for the whole scope
    let sumTotal = 0;
    let sumCorrect = 0;
    for (const r of records || []) {
      sumTotal += 1;
      if (r.is_correct === true) sumCorrect += 1;
    }
    const summaryAccuracy =
      sumTotal > 0 ? Math.round((sumCorrect / sumTotal) * 100) : null;

    return res.status(200).json({
      ok: true,
      scope,
      class_label: class_label ?? null,
      year: year ? Number(year) : null,
      student_id: student_id ?? null,
      days: Number(days),
      table_num: tnum,
      breakdown,
      summary: { total: sumTotal, correct: sumCorrect, accuracy: summaryAccuracy },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
