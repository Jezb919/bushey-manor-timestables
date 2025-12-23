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
    const data = JSON.parse(raw);
    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;
    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

function pickScoreRow(a) {
  // Try common patterns in attempts rows:
  // - score_percent / score / percent
  // - correct / total (various names)
  const percent =
    a.score_percent ?? a.scorePercent ?? a.percent ?? a.percentage ?? a.score_pct ?? null;

  if (typeof percent === "number") return Math.max(0, Math.min(100, percent));

  const correct =
    a.correct ?? a.correct_count ?? a.correctCount ?? a.num_correct ?? a.right ?? a.correct_answers ?? null;
  const total =
    a.total ?? a.total_count ?? a.totalCount ?? a.num_questions ?? a.question_count ?? a.questions ?? null;

  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    return Math.round((correct / total) * 100);
  }

  // If we only have a score 0..1 or 0..100:
  const score = a.score ?? a.result ?? null;
  if (typeof score === "number") {
    if (score <= 1) return Math.round(score * 100);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  return null;
}

function pickSecsPerQ(a) {
  return (
    a.seconds_per_question ??
    a.secs_per_question ??
    a.time_per_question ??
    a.secondsPerQuestion ??
    null
  );
}

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const { student_id, limit } = req.query;
    if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

    // 1) Load student + class (assumes students.class_id -> classes.id)
    const { data: student, error: stErr } = await supabaseAdmin
      .from("students")
      .select("id, name, first_name, last_name, class_id, classes:class_id (id, class_label)")
      .eq("id", student_id)
      .single();

    if (stErr || !student) {
      return res.status(404).json({ ok: false, error: "Student not found" });
    }

    // 2) Permission check: teacher must be linked to student's class_id (unless admin)
    if (!isAdmin) {
      const { data: link, error: lErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", student.class_id)
        .maybeSingle();

      if (lErr) return res.status(500).json({ ok: false, error: "Permission check failed", debug: lErr.message });
      if (!link) return res.status(403).json({ ok: false, error: "Not allowed", debug: { teacher_id, student_id } });
    }

    // 3) Load attempts over time (assumes attempts.student_id)
    const rowLimit = Math.min(parseInt(limit || "60", 10) || 60, 200);

    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: true })
      .limit(rowLimit);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const series = (attempts || [])
      .map((a) => {
        const created = a.created_at || a.createdAt || a.taken_at || a.date || null;
        const score = pickScoreRow(a);
        if (!created || score === null) return null;
        return {
          date: created,
          score,
          secsPerQ: pickSecsPerQ(a),
        };
      })
      .filter(Boolean);

    const studentName =
      student.name || [student.first_name, student.last_name].filter(Boolean).join(" ").trim();

    return res.json({
      ok: true,
      student: {
        id: student.id,
        name: studentName,
        class_label: student.classes?.class_label || null,
        class_id: student.class_id,
      },
      series,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
