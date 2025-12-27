import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Auth helper (bmtt_teacher cookie) ---
function getTeacherFromCookie(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return { ok: false, error: "Not logged in" };
  try {
    const parsed = JSON.parse(raw);
    const role = parsed.role;
    const teacherId = parsed.teacher_id || parsed.teacherId;
    if (!teacherId) return { ok: false, error: "Invalid session (missing teacherId)" };
    return { ok: true, teacherId, role };
  } catch (e) {
    return { ok: false, error: "Invalid session cookie" };
  }
}

// --- Robust score (%) extraction: works with different DB column names ---
function scorePercentFromAttempt(a) {
  if (!a) return null;

  // common possibilities
  if (a.score_percent !== undefined && a.score_percent !== null) return Number(a.score_percent);
  if (a.score_pct !== undefined && a.score_pct !== null) return Number(a.score_pct);
  if (a.percent !== undefined && a.percent !== null) return Number(a.percent);
  if (a.score !== undefined && a.score !== null) return Number(a.score);
  if (a.scorePercent !== undefined && a.scorePercent !== null) return Number(a.scorePercent);

  // computed possibilities
  const correct =
    a.correct ??
    a.correct_count ??
    a.correctAnswers ??
    a.num_correct ??
    a.right ??
    null;

  const total =
    a.total ??
    a.total_count ??
    a.question_count ??
    a.questions_count ??
    a.num_questions ??
    a.out_of ??
    null;

  if (correct !== null && total !== null && Number(total) > 0) {
    return Math.round((Number(correct) / Number(total)) * 100);
  }

  return null;
}

// --- Permission check: teacher_classes has class_id, not class_label ---
async function teacherCanAccessClassLabel(teacherId, role, classLabel) {
  if (role === "admin") return { ok: true };

  // Find classes for this teacher via teacher_classes -> classes
  const { data, error } = await supabase
    .from("teacher_classes")
    .select("class_id, classes:class_id ( id, class_label )")
    .eq("teacher_id", teacherId);

  if (error) return { ok: false, error: "Permission check failed", debug: error.message };

  const labels = (data || [])
    .map((row) => row.classes?.class_label)
    .filter(Boolean);

  if (!labels.includes(classLabel)) {
    return { ok: false, error: "Not allowed for this class" };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  try {
    const { ok, teacherId, role, error } = getTeacherFromCookie(req);
    if (!ok) return res.status(401).json({ ok: false, error });

    const classLabel = String(req.query.class_label || "").trim();
    if (!classLabel) return res.status(400).json({ ok: false, error: "Missing class_label" });

    // permission
    const perm = await teacherCanAccessClassLabel(teacherId, role, classLabel);
    if (!perm.ok) return res.status(403).json({ ok: false, error: perm.error, debug: perm.debug });

    // pupils in class
    const { data: pupils, error: pupilsErr } = await supabase
      .from("students")
      .select("id, first_name, surname, class_label")
      .eq("class_label", classLabel)
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: pupilsErr.message });
    }

    const pupilIds = (pupils || []).map((p) => p.id);
    if (pupilIds.length === 0) {
      return res.json({ ok: true, class_label: classLabel, rows: [], concerns: [] });
    }

    // attempts for these pupils (latest first)
    const { data: attempts, error: attErr } = await supabase
      .from("attempts")
      .select("*")
      .in("student_id", pupilIds)
      .order("created_at", { ascending: false });

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    // group attempts by student_id
    const byStudent = {};
    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(a);
    }

    const rows = (pupils || []).map((p) => {
      const list = byStudent[p.id] || [];
      const scores = list.map(scorePercentFromAttempt).filter((v) => v !== null && !Number.isNaN(v));
      const latest = scores.length ? scores[0] : null;

      const recent5 = scores.slice(0, 5);
      const recentText = recent5.length ? recent5.map((s) => `${s}%`).join(", ") : "—";

      return {
        id: p.id,
        first_name: p.first_name || "",
        surname: p.surname || "",
        class_label: p.class_label,
        latest_score: latest,
        recent_text: recentText,
        attempt_count: list.length,
      };
    });

    const concerns = rows
      .filter((r) => r.latest_score !== null && r.latest_score <= 70)
      .sort((a, b) => (a.latest_score ?? 999) - (b.latest_score ?? 999));

    return res.json({ ok: true, class_label: classLabel, rows, concerns });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
