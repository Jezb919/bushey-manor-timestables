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
  // Try common “already percent” fields
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

  // Try correct/total pattern
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

  // If we can’t calculate, return null (NOT 0)
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

    // Permission: admin sees all. Teacher must be linked to that class.
    if (session.role !== "admin") {
      // First try direct class_label column in teacher_classes
      const { data: link1, error: linkErr1 } = await supabase
        .from("teacher_classes")
        .select("teacher_id, class_label")
        .eq("teacher_id", session.teacher_id)
        .eq("class_label", class_label)
        .maybeSingle();

      if (linkErr1) {
        return res.status(403).json({
          ok: false,
          error: "Permission check failed",
          debug: linkErr1.message,
        });
      }

      if (!link1) {
        // Fallback: teacher_classes uses class_id instead, join to classes
        const { data: links2, error: linkErr2 } = await supabase
          .from("teacher_classes")
          .select("class_id, classes:class_id(class_label)")
          .eq("teacher_id", session.teacher_id);

        if (linkErr2) {
          return res.status(403).json({
            ok: false,
            error: "Permission check failed",
            debug: linkErr2.message,
          });
        }

        const allowed = (links2 || []).some(
          (r) => r.classes?.class_label === class_label
        );
        if (!allowed) {
          return res.status(403).json({ ok: false, error: "Not allowed" });
        }
      }
    }

    // ✅ Load pupils for this class (correct columns!)
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

    // No pupils? return empty
    if (!ids.length) {
      return res.json({ ok: true, class_label, pupils: [] });
    }

    // ✅ Load attempts for those pupils
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

    // Build response rows
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
