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

  const correct = a.correct ?? a.correct_count ?? a.correctCount ?? a.num_correct ?? null;
  const total = a.total ?? a.total_count ?? a.totalCount ?? a.num_questions ?? a.question_count ?? null;

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

function studentName(s) {
  return s.first_name || s.username || s.student_id || "Pupil";
}

function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const class_id = String(req.query.class_id || "");
    if (!class_id) return res.status(400).json({ ok: false, error: "Missing class_id" });

    // Permission: teacher must be linked to class unless admin
    if (!isAdmin) {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", class_id)
        .maybeSingle();

      if (linkErr) return res.status(500).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("id", class_id)
      .maybeSingle();

    if (cErr || !cls) return res.status(404).json({ ok: false, error: "Class not found" });

    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, username, student_id, class_id, class_label")
      .eq("class_id", class_id)
      .order("first_name", { ascending: true });

    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    const studentIds = (students || []).map((s) => s.id).filter(Boolean);
    if (!studentIds.length) return res.json({ ok: true, class: cls, months: [], students: [] });

    // Last 6 months (incl current)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKeyFromDate(d));
    }
    const earliest = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Attempts
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true })
      .limit(50000);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    // bucket: `${studentId}|YYYY-MM` -> {sum,count}
    const bucket = new Map();

    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!sid) continue;

      const d = new Date(a.created_at || a.taken_at || a.date);
      if (Number.isNaN(d.getTime()) || d < earliest) continue;

      const m = monthKeyFromDate(d);
      if (!months.includes(m)) continue;

      const score = toPct(a);
      if (score === null) continue;

      const key = `${sid}|${m}`;
      const cur = bucket.get(key) || { sum: 0, count: 0 };
      cur.sum += score;
      cur.count += 1;
      bucket.set(key, cur);
    }

    const outStudents = (students || []).map((s) => {
      const values = {};
      for (const m of months) {
        const key = `${s.id}|${m}`;
        const v = bucket.get(key);
        values[m] = v && v.count ? Math.round(v.sum / v.count) : null;
      }
      return {
        id: s.id,
        name: studentName(s),
        class_label: s.class_label || cls.class_label,
        values,
      };
    });

    return res.json({ ok: true, class: cls, months, students: outStudents });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
