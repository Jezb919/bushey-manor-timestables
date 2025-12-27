import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      teacher_id: p.teacherId || p.teacher_id || null,
      role: p.role || null,
      email: p.email || null,
    };
  } catch {
    return null;
  }
}

function pctFromAttempt(a) {
  const direct =
    a.score ??
    a.score_percent ??
    a.percentage ??
    a.percent ??
    a.score_pct ??
    null;

  if (direct !== null && direct !== undefined) {
    const n = Number(direct);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  const correct = a.correct ?? a.num_correct ?? a.correct_count ?? null;
  const total =
    a.total ??
    a.num_questions ??
    a.question_count ??
    a.total_questions ??
    null;

  if (correct !== null && total) {
    const n = Math.round((Number(correct) / Number(total)) * 100);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

export default async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const class_label = String(req.query.class_label || "").trim();
    if (!class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    // 1) Look up class_id from the classes table
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .maybeSingle();

    if (clsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load class",
        debug: clsErr.message,
      });
    }

    if (!cls?.id) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // 2) Permission check:
    // admin = allowed, teacher must have row in teacher_classes for (teacher_id + class_id)
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (linkErr) {
        return res.status(403).json({
          ok: false,
          error: "Permission check failed",
          debug: linkErr.message,
        });
      }

      if (!link) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this class",
          debug: { teacher_id: session.teacher_id, class_label, class_id: cls.id },
        });
      }
    }

    // 3) Load pupils (your students table uses class_label)
    const { data: pupils, error: pupilsErr } = await supabase
      .from("students")
      .select("id, first_name, surname, class_label")
      .eq("class_label", class_label)
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load pupils",
        debug: pupilsErr.message,
      });
    }

    const pupilList = pupils || [];
    const ids = pupilList.map((p) => p.id).filter(Boolean);

    if (!ids.length) {
      return res.json({ ok: true, class_label, pupils: [] });
    }

    // 4) Load attempts for those pupils
    const { data: attempts, error: attemptsErr } = await supabase
      .from("attempts")
      .select("*")
      .in("student_id", ids)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (attemptsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load attempts",
        debug: attemptsErr.message,
      });
    }

    const byStudent = new Map();
    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!sid) continue;
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid).push(a);
    }

    const out = pupilList.map((p) => {
      const list = byStudent.get(p.id) || [];
      const scores = list
        .map((a) => pctFromAttempt(a))
        .filter((x) => x !== null && x !== undefined);

      const latest_score = scores.length ? scores[0] : null;
      const recent_scores = scores.slice(0, 5);

      return {
        id: p.id,
        first_name: p.first_name || "",
        surname: p.surname || "",
        class_label: p.class_label,
        latest_score,
        recent_scores,
        attempts_count: list.length,
      };
    });

    return res.json({ ok: true, class_label, pupils: out });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e),
    });
  }
}
