import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------- cookie helpers --------
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function getTeacherFromCookie(req) {
  const cookies = parseCookies(req);
  const token = cookies.bmtt_teacher || "";
  if (!token) return null;

  // Your bmtt_teacher is JSON (not JWT) in your debug output.
  try {
    const obj = JSON.parse(token);
    const teacher_id = obj.teacher_id || obj.teacherId;
    const role = obj.role || "teacher";
    const email = obj.email || "";
    return teacher_id ? { teacher_id, role, email } : null;
  } catch {
    return null;
  }
}

// score helper (handles “unknown column names” safely)
function getScorePercentFromAttempt(a) {
  // common possibilities
  const candidates = [
    a.score_percent,
    a.scorePercent,
    a.percent,
    a.percentage,
    a.score,
    a.score_pct,
    a.result_percent,
  ].filter((v) => typeof v === "number");

  if (candidates.length) return candidates[0];

  // compute if we have counts
  const correct =
    (typeof a.correct_count === "number" && a.correct_count) ||
    (typeof a.correct_answers === "number" && a.correct_answers) ||
    (typeof a.num_correct === "number" && a.num_correct) ||
    null;

  const total =
    (typeof a.question_count === "number" && a.question_count) ||
    (typeof a.num_questions === "number" && a.num_questions) ||
    (typeof a.total_questions === "number" && a.total_questions) ||
    null;

  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    return Math.round((correct / total) * 100);
  }

  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const { class_label, debug } = req.query;
    if (!class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    const session = getTeacherFromCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // 1) Find class by label (M4)
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("class_label", class_label)
      .single();

    if (clsErr || !cls) {
      return res
        .status(404)
        .json({ ok: false, error: "Class not found", debug: clsErr?.message });
    }

    // 2) Permission check:
    // teacher can see only mapped class_id; admin can see all
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Permission check failed",
          debug: linkErr.message,
        });
      }
      if (!link) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this class",
          debug:
            debug === "1"
              ? { teacher_id: session.teacher_id, class_label, class_id: cls.id }
              : undefined,
        });
      }
    }

    // 3) Load pupils in this class
    const { data: pupils, error: pupilsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_label")
      .eq("class_label", class_label)
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load pupils",
        debug: pupilsErr.message,
      });
    }

    const pupilIds = (pupils || []).map((p) => p.id);
    if (!pupilIds.length) {
      return res.json({
        ok: true,
        class: cls,
        pupils: [],
        concerns: [],
      });
    }

    // 4) Load attempts for these pupils (latest first)
    const { data: attempts, error: attemptsErr } = await supabaseAdmin
      .from("attempts")
      .select("*")
      .in("student_id", pupilIds)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (attemptsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load attempts",
        debug: attemptsErr.message,
      });
    }

    // 5) Build per-pupil summary
    const byPupil = new Map();
    (attempts || []).forEach((a) => {
      const sid = a.student_id;
      if (!byPupil.has(sid)) byPupil.set(sid, []);
      byPupil.get(sid).push(a);
    });

    const rows = (pupils || []).map((p) => {
      const list = byPupil.get(p.id) || [];
      const scores = list
        .map(getScorePercentFromAttempt)
        .filter((v) => typeof v === "number");

      const latest = scores.length ? scores[0] : null;
      const recent = scores.slice(0, 5);
      const attempts_count = list.length;

      return {
        id: p.id,
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "(no name)",
        latest_score: latest,
        recent_scores: recent,
        attempts_count,
      };
    });

    // concerns: <= 70% only
    const concerns = rows
      .filter((r) => typeof r.latest_score === "number" && r.latest_score <= 70)
      .sort((a, b) => (a.latest_score ?? 999) - (b.latest_score ?? 999));

    return res.json({
      ok: true,
      class: cls,
      pupils: rows,
      concerns,
      debug: debug === "1" ? { attempt_rows: attempts?.length || 0 } : undefined,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "Server error", debug: String(e) });
  }
}
