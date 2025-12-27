import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseTeacherCookie(req) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map(s => s.trim()).find(s => s.startsWith("bmtt_teacher="));
  if (!match) return null;

  const val = decodeURIComponent(match.split("=").slice(1).join("="));
  try {
    const obj = JSON.parse(val);
    return {
      teacher_id: obj.teacher_id || obj.teacherId,
      role: obj.role,
      email: obj.email,
      full_name: obj.full_name
    };
  } catch {
    return null;
  }
}

function attemptPercent(a) {
  // Be flexible: different schemas over time
  if (a.score_percent != null) return Math.round(Number(a.score_percent));
  if (a.percent != null) return Math.round(Number(a.percent));
  if (a.score != null && Number(a.score) <= 1) return Math.round(Number(a.score) * 100);
  if (a.score != null) return Math.round(Number(a.score));
  const correct =
    a.correct_answers ?? a.correct_count ?? a.num_correct ?? a.correct ?? null;
  const total =
    a.total_questions ?? a.question_count ?? a.num_questions ?? a.total ?? null;

  if (correct != null && total != null && Number(total) > 0) {
    return Math.round((Number(correct) / Number(total)) * 100);
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const session = parseTeacherCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    // Load pupil
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, username, class_id, class_label")
      .eq("id", student_id)
      .single();

    if (pupilErr || !pupil) {
      return res.status(404).json({ ok: false, error: "Pupil not found", debug: pupilErr?.message });
    }

    // Permission check (admins can see all)
    if (session.role !== "admin") {
      let classId = pupil.class_id;

      if (!classId && pupil.class_label) {
        const { data: cls } = await supabaseAdmin
          .from("classes")
          .select("id")
          .eq("class_label", pupil.class_label)
          .maybeSingle();
        classId = cls?.id || null;
      }

      if (!classId) {
        return res.status(403).json({ ok: false, error: "Permission check failed", debug: "Pupil has no class_id" });
      }

      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", classId)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!link) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }
    }

    // Attempts
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    const series = (attempts || []).map((a) => ({
      attempt_id: a.id,
      created_at: a.created_at,
      score: attemptPercent(a)
    }));

    return res.json({ ok: true, pupil, series });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
