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

  const score = a.score ?? a.result ?? null;
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

    // ✅ Find student by EITHER students.id OR students.student_id
    const { data: student, error: stErr } = await supabaseAdmin
      .from("students")
      .select("id, student_id, first_name, year, class_label, class_id, username")
      .or(`id.eq.${student_id},student_id.eq.${student_id}`)
      .maybeSingle();

    if (stErr) {
      return res.status(500).json({ ok: false, error: "Failed to load student", debug: stErr.message });
    }
    if (!student) {
      return res.status(404).json({
        ok: false,
        error: "Student not found",
        debug: { student_id_received: student_id },
      });
    }

    // Permission check (teacher must be linked to student's class_id unless admin)
    if (!isAdmin) {
      const { data: link, error: lErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", student.class_id)
        .maybeSingle();

      if (lErr) return res.status(500).json({ ok: false, error: "Permission check failed", debug: lErr.message });
      if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
    }

    // ✅ Attempts usually link via attempts.student_id = students.student_id
    const attemptStudentId = student.student_id || student.id;

    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("student_id", attemptStudentId)
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

    return res.json({
      ok: true,
      student: {
        id: student.id,
        student_id: student.student_id,
        name: student.first_name || student.username || student.student_id || student.id,
        year: student.year ?? null,
        class_label: student.class_label ?? null,
        class_id: student.class_id ?? null,
      },
      series,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
