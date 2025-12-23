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

    const { class_id } = req.query;
    if (!class_id) return res.status(400).json({ ok: false, error: "Missing class_id" });

    // Permission: teachers only see their mapped classes
    if (!isAdmin) {
      const { data: link, error: lErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", class_id)
        .maybeSingle();

      if (lErr) return res.status(500).json({ ok: false, error: "Permission check failed", debug: lErr.message });
      if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // Get class label
    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year")
      .eq("id", class_id)
      .maybeSingle();

    if (cErr) return res.status(500).json({ ok: false, error: "Failed to load class", debug: cErr.message });
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

    // Students in class
    const { data: students, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("class_id", class_id);

    if (sErr) return res.status(500).json({ ok: false, error: "Failed to load students", debug: sErr.message });

    const studentIds = (students || []).map((s) => s.id).filter(Boolean);
    if (!studentIds.length) {
      return res.json({ ok: true, class: cls, series: [] });
    }

    // Attempts for those students
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true })
      .limit(5000);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    // Bucket into months YYYY-MM
    const bucket = new Map(); // key -> {sum,count}
    for (const a of attempts || []) {
      const score = toPct(a);
      if (score === null) continue;

      const d = new Date(a.created_at || a.taken_at || a.date);
      if (Number.isNaN(d.getTime())) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = bucket.get(key) || { sum: 0, count: 0 };
      cur.sum += score;
      cur.count += 1;
      bucket.set(key, cur);
    }

    const series = [...bucket.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        // keep as month key; client will label it nicely
        month,
        score: v.count ? Math.round(v.sum / v.count) : null,
      }))
      .filter((x) => typeof x.score === "number");

    return res.json({ ok: true, class: cls, series });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
