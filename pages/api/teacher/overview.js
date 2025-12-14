// pages/api/teacher/overview.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    const {
      class_label,
      scope = "class", // class | year | school | student
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
      // matches M4, B4 etc (anything ending in 4)
      studentsQuery = studentsQuery.ilike("class_label", `%${String(year).trim()}`);
    }

    if (scope === "student" && student_id) {
      studentsQuery = studentsQuery.eq("id", student_id);
    }

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    const studentIds = (students || []).map((s) => s.id);

    /* ---------------- ATTEMPTS ---------------- */
    let attemptsQuery = supabase
      .from("attempts")
      .select("id, student_id, class_label, score, total, percent, created_at")
      .gte("created_at", since.toISOString());

    if (studentIds.length > 0) {
      attemptsQuery = attemptsQuery.in("student_id", studentIds);
    } else if (scope !== "school") {
      attemptsQuery = attemptsQuery.limit(0);
    }

    const { data: attempts, error: attemptsError } = await attemptsQuery;
    if (attemptsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load attempts",
        details: attemptsError.message,
      });
    }

    /* ---------------- LEADERBOARD ---------------- */
    const leaderboard = (students || []).map((s) => {
      const studentAttempts = (attempts || [])
        .filter((a) => a.student_id === s.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const latest = studentAttempts[0];

      return {
        student_id: s.id,
        student: s.first_name,
        class_label: s.class_label,
        latest_attempt_id: latest?.id ?? null,
        latest_at: latest?.created_at ?? null,
        score: latest?.score ?? null,
        total: latest?.total ?? null,
        percent: latest?.percent ?? null,
        attempts_in_range: studentAttempts.length,
      };
    });

    /* ---------------- TREND ---------------- */
    const trendMap = {};
    for (const a of attempts || []) {
      if (typeof a.percent !== "number") continue;
      const day = String(a.created_at).slice(0, 10);
      if (!trendMap[day]) trendMap[day] = { sum: 0, count: 0 };
      trendMap[day].sum += a.percent;
      trendMap[day].count += 1;
    }

    const classTrend = Object.entries(trendMap).map(([day, v]) => ({
      day,
      avg_percent: v.count ? Math.round(v.sum / v.count) : null,
      attempts: v.count,
    }));

    /* ---------------- QUESTION RECORDS ---------------- */
    let qrQuery = supabase
      .from("question_records")
      .select("*")
      .gte("created_at", since.toISOString());

    if (studentIds.length > 0) {
      qrQuery = qrQuery.in("student_id", studentIds);
    } else if (scope !== "school") {
      qrQuery = qrQuery.limit(0);
    }

    const { data: records, error: qrError } = await qrQuery;
    if (qrError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to read question_records",
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
      const tableNum = r.table_num ?? r.table ?? r.multiplier ?? r.times_table;
      if (!tableNum || tableNum < 1 || tableNum > 19) continue;

      const isCorrect =
        r.is_correct ??
        r.was_correct ??
        r.correct ??
        r.wasCorrect ??
        r.isCorrect ??
        false;

      const cell = tableHeat[Number(tableNum) - 1];
      cell.total += 1;
      if (isCorrect) cell.correct += 1;
    }

    for (const cell of tableHeat) {
      cell.accuracy =
        cell.total > 0 ? Math.round((cell.correct / cell.total) * 100) : null;
    }

    // ✅ ADD: tableBreakdown (shape the teacher UI expects)
    const tableBreakdown = tableHeat.map((t) => ({
      table: t.table_num,
      total: t.total,
      correct: t.correct,
      accuracy: t.accuracy,
    }));

    return res.status(200).json({
      ok: true,
      scope,
      class_label: class_label ?? null,
      year: year ? Number(year) : null,
      days: Number(days),
      leaderboard,
      classTrend,
      tableHeat,
      tableBreakdown, // ✅ NEW
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
