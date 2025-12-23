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

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!raw) return null;

  try {
    const data = JSON.parse(raw); // your cookie is JSON
    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;
    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

function toPct(attempt) {
  const pct =
    attempt.score_percent ?? attempt.scorePercent ?? attempt.percent ?? attempt.percentage ?? null;
  if (typeof pct === "number") return Math.max(0, Math.min(100, Math.round(pct)));

  const correct =
    attempt.correct ?? attempt.correct_count ?? attempt.correctCount ?? attempt.num_correct ?? null;
  const total =
    attempt.total ?? attempt.total_count ?? attempt.totalCount ?? attempt.num_questions ?? attempt.question_count ?? null;

  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    return Math.round((correct / total) * 100);
  }

  const score = attempt.score ?? attempt.result ?? null;
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

    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

    // ✅ NOTE: adjust these if your students table is named differently
    const { data: student, error: stErr } = await supabaseAdmin
      .from("students")
      .select("id, name, first_name, last_name, class_id, class_label, classes:class_id (id, class_label)")
      .eq("id", student_id)
      .single();

    if (stErr || !student) return res.status(404).json({ ok: false, error: "Student not found" });

    // Permission check for non-admin
    const studentClassId = student.class_id || student.classes?.id || null;
    if (!isAdmin && studentClassId) {
      const { data: link } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", studentClassId)
        .maybeSingle();

      if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // Pull attempts for that pupil
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: true })
      .limit(120);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const series = (attempts || [])
      .map((a) => {
        const date = a.created_at || a.taken_at || a.date;
        const score = toPct(a);
        if (!date || score === null) return null;
        return { date, score };
      })
      .filter(Boolean);

    const name =
      student.name || [student.first_name, student.last_name].filter(Boolean).join(" ").trim();

    const class_label = student.class_label || student.classes?.class_label || null;

    return res.json({
      ok: true,
      student: { id: student.id, name, class_label },
      series,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
