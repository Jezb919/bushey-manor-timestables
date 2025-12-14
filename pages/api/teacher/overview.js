import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWED_CLASSES = ["M3","B3","M4","B4","M5","B5","M6","B6"];

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function safeInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    const class_label = String(req.query.class_label || "M4").toUpperCase().trim();
    const days = safeInt(req.query.days, 30);

    if (!ALLOWED_CLASSES.includes(class_label)) {
      return res.status(400).json({ error: "Invalid class_label" });
    }

    const since = daysAgoISO(days);

    // 1) Get all students in this class
    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, class_label")
      .eq("class_label", class_label);

    if (sErr) return res.status(500).json({ error: "Students query failed", details: sErr.message });

    const studentIds = (students || []).map((s) => s.id);
    if (studentIds.length === 0) {
      return res.status(200).json({
        ok: true,
        class_label,
        days,
        students: [],
        leaderboard: [],
        classTrend: [],
        tableHeat: [],
      });
    }

    // 2) Fetch attempts for this class in timeframe
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("id, student_id, created_at, score, total, percent, completed")
      .eq("class_label", class_label)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (aErr) return res.status(500).json({ error: "Attempts query failed", details: aErr.message });

    // Group attempts by student
    const byStudent = new Map();
    for (const s of students) byStudent.set(s.id, []);
    for (const a of attempts || []) {
      if (!byStudent.has(a.student_id)) continue;
      byStudent.get(a.student_id).push(a);
    }

    // 3) Leaderboard: latest attempt + previous attempt delta
    const leaderboard = students
      .map((s) => {
        const list = byStudent.get(s.id) || [];
        const latest = list.length ? list[list.length - 1] : null;
        const prev = list.length >= 2 ? list[list.length - 2] : null;

        const latestPercent = latest?.percent ?? (latest && latest.total ? Math.round((latest.score / latest.total) * 100) : null);
        const prevPercent = prev?.percent ?? (prev && prev.total ? Math.round((prev.score / prev.total) * 100) : null);

        const delta = (latestPercent !== null && prevPercent !== null) ? (latestPercent - prevPercent) : null;

        return {
          student_id: s.id,
          student: s.first_name,
          class_label: s.class_label,
          latest_attempt_id: latest?.id ?? null,
          latest_at: latest?.created_at ?? null,
          score: latest?.score ?? null,
          total: latest?.total ?? null,
          percent: latestPercent,
          delta_percent: delta,
          attempts_in_range: list.length,
        };
      })
      // show most recent / strongest by default
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));

    // 4) Class trend over time (daily average percent)
    // Bucket attempts by day (YYYY-MM-DD)
    const dayMap = new Map();
    for (const a of attempts || []) {
      const day = String(a.created_at).slice(0, 10);
      const p = a.percent ?? (a.total ? Math.round((a.score / a.total) * 100) : 0);
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day).push(p);
    }

    const classTrend = Array.from(dayMap.entries())
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([day, arr]) => ({
        day,
        avg_percent: Math.round(arr.reduce((sum, v) => sum + v, 0) / arr.length),
        attempts: arr.length,
      }));

    // 5) Table heat (class aggregate) using question_records
    const { data: qr, error: qErr } = await supabaseAdmin
      .from("question_records")
      .select("table_num, is_correct, created_at")
      .in("student_id", studentIds)
      .gte("created_at", since);

    if (qErr) return res.status(500).json({ error: "Question records query failed", details: qErr.message });

    const heat = new Map(); // table_num -> {correct, total}
    for (let t = 1; t <= 19; t++) heat.set(t, { table_num: t, correct: 0, total: 0 });

    for (const r of qr || []) {
      const t = Number(r.table_num);
      if (!heat.has(t)) continue;
      const obj = heat.get(t);
      obj.total += 1;
      if (r.is_correct) obj.correct += 1;
    }

    const tableHeat = Array.from(heat.values()).map((x) => ({
      table_num: x.table_num,
      total: x.total,
      correct: x.correct,
      accuracy: x.total ? Math.round((x.correct / x.total) * 100) : null,
    }));

    return res.status(200).json({
      ok: true,
      class_label,
      days,
      leaderboard,
      classTrend,
      tableHeat,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err?.message || err) });
  }
}
