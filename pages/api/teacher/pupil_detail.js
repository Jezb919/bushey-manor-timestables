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
    a.questions_total ??
    null;

  if (correct !== null && total) {
    const n = Math.round((Number(correct) / Number(total)) * 100);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function tablesFromAttempt(a) {
  // try common patterns
  const t =
    a.tables_selected ??
    a.tables_included ??
    a.tables ??
    a.tables_list ??
    null;

  if (Array.isArray(t)) return t;
  if (typeof t === "string") {
    // could be "{1,2,3}" or "1,2,3"
    return t
      .replace(/[{}\[\]]/g, "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

export default async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });

    const pupil_id = String(req.query.pupil_id || "").trim();
    if (!pupil_id) return res.status(400).json({ ok: false, error: "Missing pupil_id" });

    // Load pupil
    const { data: pupil, error: pErr } = await supabase
      .from("students")
      .select("id, first_name, surname, class_label")
      .eq("id", pupil_id)
      .maybeSingle();

    if (pErr) return res.status(500).json({ ok: false, error: "Failed to load pupil", debug: pErr.message });
    if (!pupil) return res.status(404).json({ ok: false, error: "Pupil not found" });

    // Permission: admin can see all. teacher can only see pupils in their assigned classes.
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("teacher_id, class_id, class_label")
        .eq("teacher_id", session.teacher_id)
        .eq("class_label", pupil.class_label)
        .maybeSingle();

      // some schemas don't have class_label in teacher_classes; fallback via classes table
      if (linkErr) {
        // try mapping teacher_classes -> classes by class_id
        const { data: links2, error: linkErr2 } = await supabase
          .from("teacher_classes")
          .select("class_id, classes:class_id(class_label)")
          .eq("teacher_id", session.teacher_id);

        if (linkErr2) {
          return res.status(403).json({ ok: false, error: "Permission check failed", debug: linkErr2.message });
        }

        const allowed = (links2 || []).some((r) => r.classes?.class_label === pupil.class_label);
        if (!allowed) return res.status(403).json({ ok: false, error: "Not allowed" });
      } else {
        if (!link) return res.status(403).json({ ok: false, error: "Not allowed" });
      }
    }

    // Load attempts (all attempts)
    const { data: attempts, error: aErr } = await supabase
      .from("attempts")
      .select("*")
      .eq("student_id", pupil_id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const list = attempts || [];

    // series for graph (last 60 points, oldest -> newest)
    const series = list
      .slice(0, 60)
      .map((a) => ({
        date: a.created_at || a.completed_at || a.createdAt || null,
        score: pctFromAttempt(a),
      }))
      .filter((x) => x.date && x.score !== null)
      .reverse();

    // attempt rows (last 20)
    const rows = list.slice(0, 20).map((a) => ({
      id: a.id,
      date: a.created_at || a.completed_at || a.createdAt || null,
      score: pctFromAttempt(a),
      tables: tablesFromAttempt(a),
      num_questions: a.num_questions ?? a.question_count ?? a.total ?? null,
      seconds_per_question: a.time_per_question ?? a.seconds_per_question ?? null,
    }));

    return res.json({
      ok: true,
      pupil: {
        id: pupil.id,
        name: `${pupil.first_name || ""} ${pupil.surname || ""}`.trim(),
        class_label: pupil.class_label,
      },
      series,
      rows,
      target: 90,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
