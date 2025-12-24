import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---- session helpers ----
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

// ---- score normaliser ----
function toPct(a) {
  const pct =
    a.score_percent ?? a.scorePercent ?? a.percent ?? a.percentage ?? a.score_pct ?? null;
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

function safeStudentName(s) {
  return s.first_name || s.username || s.student_id || "Pupil";
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const year = Number(req.query.year);
    const windowDays = Math.max(7, Math.min(90, Number(req.query.window || 30))); // 7..90

    if (!Number.isFinite(year)) {
      return res.status(400).json({ ok: false, error: "Missing/invalid year" });
    }

    // Teachers: only allow years they belong to
    if (!isAdmin) {
      const { data: links, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher_id);

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Failed to read teacher_classes", debug: linkErr.message });
      }

      const classIds = (links || []).map((l) => l.class_id).filter(Boolean);
      if (!classIds.length) return res.status(403).json({ ok: false, error: "Not allowed" });

      const { data: allowedClasses, error: aErr } = await supabaseAdmin
        .from("classes")
        .select("id, year_group")
        .in("id", classIds);

      if (aErr) {
        return res.status(500).json({ ok: false, error: "Failed to load allowed classes", debug: aErr.message });
      }

      const allowedYears = new Set(
        (allowedClasses || []).map((c) => Number(c.year_group)).filter((y) => Number.isFinite(y))
      );
      if (!allowedYears.has(year)) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // Load classes in year
    let { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("year_group", year)
      .order("class_label", { ascending: true });

    if (cErr) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: cErr.message });

    // retry if year_group stored as text
    if (!classes || classes.length === 0) {
      const retry = await supabaseAdmin
        .from("classes")
        .select("id, class_label, year_group")
        .eq("year_group", String(year))
        .order("class_label", { ascending: true });

      if (retry.error) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: retry.error.message });
      classes = retry.data || [];
    }

    const classIds = (classes || []).map((c) => c.id);
    if (!classIds.length) return res.json({ ok: true, year, windowDays, topImprovers: [], concerns: [] });

    // Students in those classes
    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, username, student_id, class_id, class_label")
      .in("class_id", classIds);

    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    const studentIds = (students || []).map((s) => s.id).filter(Boolean);
    if (!studentIds.length) return res.json({ ok: true, year, windowDays, topImprovers: [], concerns: [] });

    // Attempts (select * to avoid schema mismatch)
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true })
      .limit(30000);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    // time windows
    const now = new Date();
    const msDay = 24 * 60 * 60 * 1000;
    const recentStart = new Date(now.getTime() - windowDays * msDay);
    const prevStart = new Date(now.getTime() - windowDays * 2 * msDay);

    // maps
    const classLabelById = new Map((classes || []).map((c) => [c.id, c.class_label]));
    const studentById = new Map((students || []).map((s) => [s.id, s]));

    // per-student stats
    const stats = new Map(); // sid -> { recentSum, recentCount, prevSum, prevCount }

    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!sid) continue;

      const score = toPct(a);
      if (score === null) continue;

      const d = new Date(a.created_at || a.taken_at || a.date);
      if (Number.isNaN(d.getTime())) continue;

      let st = stats.get(sid);
      if (!st) {
        st = { recentSum: 0, recentCount: 0, prevSum: 0, prevCount: 0 };
        stats.set(sid, st);
      }

      if (d >= recentStart) {
        st.recentSum += score;
        st.recentCount += 1;
      } else if (d >= prevStart && d < recentStart) {
        st.prevSum += score;
        st.prevCount += 1;
      }
    }

    // build rows
    const rows = [];
    for (const [sid, st] of stats.entries()) {
      const s = studentById.get(sid);
      if (!s) continue;

      const recentAvg = st.recentCount ? Math.round(st.recentSum / st.recentCount) : null;
      const prevAvg = st.prevCount ? Math.round(st.prevSum / st.prevCount) : null;
      const delta = (recentAvg != null && prevAvg != null) ? (recentAvg - prevAvg) : null;

      rows.push({
        student_id: sid,
        name: safeStudentName(s),
        class_label: s.class_label || classLabelById.get(s.class_id) || "",
        recentAvg,
        prevAvg,
        delta,
        recentCount: st.recentCount,
        prevCount: st.prevCount,
      });
    }

    // Top improvers: must have data in both windows, positive delta
    const topImprovers = rows
      .filter((r) => r.delta != null && r.delta > 0 && r.recentCount >= 2 && r.prevCount >= 2)
      .sort((a, b) => (b.delta - a.delta) || (b.recentAvg - a.recentAvg))
      .slice(0, 10);

    // ✅ Concern list: ONLY 70% or below, with 2+ recent attempts
    const concerns = rows
      .filter(
        (r) =>
          r.recentAvg !== null &&
          Number(r.recentAvg) <= 70 &&
          r.recentCount >= 2
      )
      .sort((a, b) => Number(a.recentAvg) - Number(b.recentAvg))
      .slice(0, 10);

    return res.json({ ok: true, year, windowDays, topImprovers, concerns });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
