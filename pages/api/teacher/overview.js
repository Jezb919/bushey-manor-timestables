import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = Array.from({ length: 19 }).map((_, i) => i + 1);

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 30));
  return d.toISOString();
}

function getYearFromClassLabel(classLabel) {
  // expected: M4, B4, M3, B3, M5, B5, M6, B6
  const s = String(classLabel || "").trim().toUpperCase();
  const last = s.slice(-1);
  return ["3", "4", "5", "6"].includes(last) ? last : null;
}

function classMatchesYear(classLabel, yearDigit) {
  const s = String(classLabel || "").trim().toUpperCase();
  return s.endsWith(String(yearDigit));
}

function dateKey(iso) {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Use GET" });

  try {
    const class_label = String(req.query.class_label || "M4").trim().toUpperCase();
    const scope = String(req.query.scope || "class").trim().toLowerCase(); // class|year|school
    const days = Number(req.query.days || 30);
    const student_id = req.query.student_id ? String(req.query.student_id) : null;

    // optional table drill-down
    const table_num = req.query.table_num ? Number(req.query.table_num) : null;

    const since = isoDaysAgo(days);
    const yearDigit = getYearFromClassLabel(class_label);

    // 1) Get students for the chosen scope
    let studentsQuery = supabaseAdmin
      .from("students")
      .select("id, first_name, class_label");

    if (scope === "class") {
      studentsQuery = studentsQuery.eq("class_label", class_label);
    } else if (scope === "year") {
      // use year from provided class_label (e.g. M4 -> year 4)
      if (yearDigit) {
        // PostgREST doesn't have "endsWith" directly; easiest is fetch all then filter.
        // But for small schools this is fine. If it grows, we can make an RPC later.
      }
    } else if (scope === "school") {
      // no filter
    } else {
      return res.status(400).json({ ok: false, error: "Invalid scope" });
    }

    const { data: studentsRaw, error: studentsErr } = await studentsQuery;
    if (studentsErr) {
      return res.status(500).json({ ok: false, error: "Failed to read students", details: studentsErr.message });
    }

    // Apply "year" filtering in JS (endsWith)
    const students =
      scope === "year" && yearDigit
        ? (studentsRaw || []).filter((s) => classMatchesYear(s.class_label, yearDigit))
        : (studentsRaw || []);

    const studentIds = students.map((s) => s.id);

    // 2) Get attempts in range (and optionally for a single student)
    let attemptsQuery = supabaseAdmin
      .from("attempts")
      .select("id, student_id, class_label, created_at, finished_at, score, total, percent")
      .gte("created_at", since);

    if (student_id) {
      attemptsQuery = attemptsQuery.eq("student_id", student_id);
    } else {
      if (scope === "class") {
        attemptsQuery = attemptsQuery.eq("class_label", class_label);
      } else if (scope === "year" && yearDigit) {
        // can't endsWith in query, filter after
      } else if (scope === "school") {
        // no filter
      }
    }

    const { data: attemptsRaw, error: attemptsErr } = await attemptsQuery;
    if (attemptsErr) {
      return res.status(500).json({ ok: false, error: "Failed to read attempts", details: attemptsErr.message });
    }

    const attemptsPre =
      scope === "year" && yearDigit && !student_id
        ? (attemptsRaw || []).filter((a) => classMatchesYear(a.class_label, yearDigit))
        : (attemptsRaw || []);

    // If scope is class/year/school, we only care about students in that scope (prevents odd rows)
    const attempts =
      student_id
        ? attemptsPre
        : attemptsPre.filter((a) => studentIds.includes(a.student_id));

    // 3) Build leaderboard
    const byStudent = new Map();
    for (const s of students) {
      byStudent.set(s.id, {
        student_id: s.id,
        student: s.first_name,
        class_label: s.class_label,
        latest_attempt_id: null,
        latest_at: null,
        score: null,
        total: null,
        percent: null,
        delta_percent: null,
        attempts_in_range: 0,
      });
    }

    // group attempts per student
    const attemptsByStudent = new Map();
    for (const a of attempts) {
      const sid = a.student_id;
      if (!attemptsByStudent.has(sid)) attemptsByStudent.set(sid, []);
      attemptsByStudent.get(sid).push(a);
    }

    for (const [sid, list] of attemptsByStudent.entries()) {
      list.sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
      const latest = list[list.length - 1];
      const prev = list.length >= 2 ? list[list.length - 2] : null;

      const row = byStudent.get(sid) || {
        student_id: sid,
        student: "(unknown)",
        class_label: latest.class_label,
        latest_attempt_id: null,
        latest_at: null,
        score: null,
        total: null,
        percent: null,
        delta_percent: null,
        attempts_in_range: 0,
      };

      row.latest_attempt_id = latest.id;
      row.latest_at = latest.created_at;
      row.score = typeof latest.score === "number" ? latest.score : null;
      row.total = typeof latest.total === "number" ? latest.total : null;

      // percent might be null if older rows; compute if possible
      const pct =
        typeof latest.percent === "number"
          ? latest.percent
          : (row.total ? Math.round((row.score / row.total) * 100) : null);

      row.percent = pct;

      const prevPct =
        prev
          ? (typeof prev.percent === "number"
              ? prev.percent
              : (prev.total ? Math.round((prev.score / prev.total) * 100) : null))
          : null;

      row.delta_percent =
        pct !== null && prevPct !== null ? pct - prevPct : null;

      row.attempts_in_range = list.length;

      byStudent.set(sid, row);
    }

    const leaderboard = Array.from(byStudent.values()).sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      return bp - ap;
    });

    // 4) Trend (avg % per day)
    const trendMap = new Map();
    for (const a of attempts) {
      const pct =
        typeof a.percent === "number"
          ? a.percent
          : (a.total ? Math.round((a.score / a.total) * 100) : null);

      if (pct === null) continue;

      const day = dateKey(a.created_at);
      if (!trendMap.has(day)) trendMap.set(day, { day, sum: 0, count: 0 });
      const t = trendMap.get(day);
      t.sum += pct;
      t.count += 1;
    }

    const classTrend = Array.from(trendMap.values())
      .map((t) => ({
        day: t.day,
        avg_percent: t.count ? Math.round(t.sum / t.count) : 0,
        attempts: t.count,
      }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));

    // 5) Heatmap based on question_records
    // We use attempt ids to filter question_records
    const attemptIds = attempts.map((a) => a.id);

    let question_records = [];
    if (attemptIds.length) {
      const qrQuery = supabaseAdmin
        .from("question_records")
        .select("attempt_id, table_num, was_correct, student_id")
        .in("attempt_id", attemptIds);

      const { data: qr, error: qrErr } = await qrQuery;
      if (qrErr) {
        return res.status(500).json({ ok: false, error: "Failed to read question_records", details: qrErr.message });
      }
      question_records = qr || [];
    }

    const tableHeatAgg = new Map();
    for (const n of TABLES) {
      tableHeatAgg.set(n, { table_num: n, total: 0, correct: 0, accuracy: null });
    }

    for (const r of question_records) {
      const n = Number(r.table_num);
      if (!tableHeatAgg.has(n)) continue;
      const agg = tableHeatAgg.get(n);
      agg.total += 1;
      if (r.was_correct) agg.correct += 1;
    }

    const tableHeat = TABLES.map((n) => {
      const agg = tableHeatAgg.get(n);
      return {
        table_num: n,
        total: agg.total,
        correct: agg.correct,
        accuracy: agg.total ? Math.round((agg.correct / agg.total) * 100) : null,
      };
    });

    // 6) Optional drill-down: per-student accuracy for a specific table
    let tableDrill = null;
    if (table_num && Number.isFinite(table_num)) {
      const drillMap = new Map(); // student_id -> {student, class_label, total, correct, accuracy}
      for (const s of students) {
        drillMap.set(s.id, { student_id: s.id, student: s.first_name, class_label: s.class_label, total: 0, correct: 0, accuracy: null });
      }

      for (const r of question_records) {
        if (Number(r.table_num) !== table_num) continue;
        const sid = r.student_id;
        if (!drillMap.has(sid)) continue;

        const item = drillMap.get(sid);
        item.total += 1;
        if (r.was_correct) item.correct += 1;
      }

      tableDrill = Array.from(drillMap.values())
        .map((x) => ({
          ...x,
          accuracy: x.total ? Math.round((x.correct / x.total) * 100) : null,
        }))
        .sort((a, b) => {
          const ap = typeof a.accuracy === "number" ? a.accuracy : -1;
          const bp = typeof b.accuracy === "number" ? b.accuracy : -1;
          return bp - ap;
        });
    }

    return res.status(200).json({
      ok: true,
      scope,
      class_label,
      year: yearDigit,
      days,
      selected_student_id: student_id,
      leaderboard,
      classTrend,
      tableHeat,
      tableDrill,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
