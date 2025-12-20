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
      year,            // e.g. 4 (we infer using class labels like M4/B4)
      student_id,
      days = 30,
    } = req.query;

    const nDays = Number(days);
    const since = new Date();
    since.setDate(since.getDate() - (Number.isFinite(nDays) ? nDays : 30));

    /* ---------------- STUDENTS ---------------- */
    let studentsQuery = supabase
      .from("students")
      .select("id, first_name, class_label");

    if (scope === "class" && class_label) {
      studentsQuery = studentsQuery.eq("class_label", class_label);
    }

    if (scope === "year" && year) {
      // matches M4, B4 etc (anything ending in 4)
      studentsQuery = studentsQuery.ilike(
        "class_label",
        `%${String(year).trim()}`
      );
    }

    if (scope === "student" && student_id) {
      studentsQuery = studentsQuery.eq("id", student_id);
    }

    // school scope = no filter

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load students",
        details: studentsError.message,
      });
    }

    const studentIds = (students || []).map((s) => s.id);

    /* ---------------- ATTEMPTS (in range) ---------------- */
    let attemptsQuery = supabase
      .from("attempts")
      .select("id, student_id, class_label, score, total, percent, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true }); // so earliest is first

    if (studentIds.length > 0) {
      attemptsQuery = attemptsQuery.in("student_id", studentIds);
    } else if (scope !== "school") {
      // if class/year/student had no matches, keep empty
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

    /* ---------------- LEADERBOARD + IMPROVEMENT ----------------
       For each student:
       - latest attempt (by created_at)
       - earliest attempt (by created_at)
       - delta_percent = latest.percent - earliest.percent (requires 2+ attempts)
    */
    const attemptsByStudent = new Map();
    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!attemptsByStudent.has(sid)) attemptsByStudent.set(sid, []);
      attemptsByStudent.get(sid).push(a);
    }

    const leaderboard = (students || []).map((s) => {
      const list = attemptsByStudent.get(s.id) || [];
      const attempts_in_range = list.length;

      // list is already sorted ascending by created_at due to query ordering
      const earliest = list[0] || null;
      const latest = list.length ? list[list.length - 1] : null;

      const earliestPercent =
        earliest && typeof earliest.percent === "number" ? earliest.percent : null;

      const latestPercent =
        latest && typeof latest.percent === "number" ? latest.percent : null;

      const delta_percent =
        attempts_in_range >= 2 &&
        typeof earliestPercent === "number" &&
        typeof latestPercent === "number"
          ? Math.round(latestPercent - earliestPercent)
          : null;

      return {
        student_id: s.id,
        student: s.first_name,
        class_label: s.class_label,

        latest_attempt_id: latest?.id ?? null,
        latest_at: latest?.created_at ?? null,
        score: latest?.score ?? null,
        total: latest?.total ?? null,
        percent: latest?.percent ?? null,

        // NEW: improvement
        earliest_at: earliest?.created_at ?? null,
        earliest_percent: earliest?.percent ?? null,
        delta_percent,

        attempts_in_range,
      };
    });

    // Optional: sort leaderboard by percent desc, then delta desc
    leaderboard.sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      if (bp !== ap) return bp - ap;

      const ad = typeof a.delta_percent === "number" ? a.delta_percent : -9999;
      const bd = typeof b.delta_percent === "number" ? b.delta_percent : -9999;
      if (bd !== ad) return bd - ad;

      const as = typeof a.score === "number" ? a.score : -1;
      const bs = typeof b.score === "number" ? b.score : -1;
      return bs - as;
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

    classTrend.sort((a, b) => (a.day > b.day ? 1 : -1));

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

      const wasCorrect =
        r.was_correct ??
        r.is_correct ??
        r.isCorrect ??
        r.correct ??
        false;

      const cell = tableHeat[Number(tableNum) - 1];
      cell.total += 1;
      if (wasCorrect) cell.correct += 1;
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
      days: Number.isFinite(nDays) ? nDays : 30,

      // outputs
      leaderboard,
      classTrend,
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
