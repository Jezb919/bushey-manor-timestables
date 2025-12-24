import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(cookieHeader = "") {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function base64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return null;

  try {
    let json = token;
    if (!json.trim().startsWith("{")) json = base64UrlDecode(token);
    const data = JSON.parse(json);

    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;

    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

function toPct(a) {
  const pct = a.score_percent ?? a.scorePercent ?? a.percent ?? a.percentage ?? a.score_pct ?? null;
  if (typeof pct === "number") return Math.max(0, Math.min(100, Math.round(pct)));

  const correct =
    a.correct ?? a.correct_count ?? a.correctCount ?? a.num_correct ?? a.right ?? null;
  const total =
    a.total ?? a.total_count ?? a.totalCount ?? a.num_questions ?? a.question_count ?? null;

  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    return Math.round((correct / total) * 100);
  }

  const score = a.score ?? a.result ?? a.value ?? null;
  if (typeof score === "number") {
    if (score <= 1) return Math.round(score * 100);
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const year = Number(req.query.year);
    if (!year || Number.isNaN(year)) return res.status(400).json({ ok: false, error: "Missing/invalid year" });

    // Teachers: only allow years they belong to
    if (!isAdmin) {
      const { data: links, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher_id);

      if (linkErr) return res.status(500).json({ ok: false, error: "Failed to read teacher_classes", debug: linkErr.message });

      const classIds = (links || []).map((l) => l.class_id).filter(Boolean);
      if (!classIds.length) return res.status(403).json({ ok: false, error: "Not allowed" });

      const { data: allowedClasses, error: aErr } = await supabaseAdmin
        .from("classes")
        .select("id, year_group")
        .in("id", classIds);

      if (aErr) return res.status(500).json({ ok: false, error: "Failed to load allowed classes", debug: aErr.message });

      const allowedYears = new Set((allowedClasses || []).map((c) => c.year_group));
      if (!allowedYears.has(year)) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // Load all classes in this year
    const { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("year_group", year)
      .order("class_label", { ascending: true });

    if (cErr) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: cErr.message });

    const classIds = (classes || []).map((c) => c.id);
    if (!classIds.length) return res.json({ ok: true, year, classes: [] });

    // Load students across those classes
    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, class_id")
      .in("class_id", classIds);

    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    const studentIds = (students || []).map((s) => s.id);
    if (!studentIds.length) {
      return res.json({
        ok: true,
        year,
        classes: (classes || []).map((c) => ({ ...c, series: [] })),
      });
    }

    // Attempts across those students (single query)
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("student_id, created_at, score, score_percent, correct, total, num_questions, question_count")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true })
      .limit(10000);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    // Build helper maps
    const studentToClass = new Map((students || []).map((s) => [s.id, s.class_id]));

    // bucket per class per month
    // key: `${classId}|YYYY-MM` -> {sum,count}
    const bucket = new Map();

    for (const a of attempts || []) {
      const score = toPct(a);
      if (score === null) continue;

      const classId = studentToClass.get(a.student_id);
      if (!classId) continue;

      const d = new Date(a.created_at);
      if (Number.isNaN(d.getTime())) continue;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const key = `${classId}|${monthKey}`;

      const cur = bucket.get(key) || { sum: 0, count: 0 };
      cur.sum += score;
      cur.count += 1;
      bucket.set(key, cur);
    }

    const out = (classes || []).map((c) => {
      // collect all months for this class
      const series = [];
      for (const [key, v] of bucket.entries()) {
        const [cid, month] = key.split("|");
        if (cid !== c.id) continue;
        if (!v.count) continue;
        series.push({ month, score: Math.round(v.sum / v.count) });
      }
      series.sort((a, b) => a.month.localeCompare(b.month));
      return { ...c, series };
    });

    return res.json({ ok: true, year, classes: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
