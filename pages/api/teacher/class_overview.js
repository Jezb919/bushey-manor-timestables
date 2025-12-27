import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Reads bmtt_teacher cookie (your app uses JSON in this cookie)
 * and returns { teacher_id, role, email, full_name }
 */
function getTeacherFromCookie(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw);
    return {
      teacher_id: obj.teacher_id || obj.teacherId || obj.id || null,
      role: obj.role || null,
      email: obj.email || null,
      full_name: obj.full_name || obj.fullName || null,
    };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { class_label, debug } = req.query;

    if (!class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    const me = getTeacherFromCookie(req);
    if (!me?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // 1) Find the class row from classes table
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found", debug: classErr?.message });
    }

    // 2) Permission check:
    // admin can see everything, teacher must be linked in teacher_classes by class_id
    if (me.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", me.teacher_id)
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
          debug: { teacher_id: me.teacher_id, role: me.role, class_label },
        });
      }
    }

    // 3) Load pupils for that class
    // NOTE: your students table (from your screenshot) has: id, first_name, class_id, class_label, username, password_hash, etc.
    // No surname column there yet, so we do NOT select it (selecting it would crash).
    const { data: pupils, error: pupilsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, class_id, class_label")
      .eq("class_id", cls.id)
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: pupilsErr.message });
    }

    const pupilIds = (pupils || []).map((p) => p.id);

    // 4) Load attempts for these pupils
    // IMPORTANT FIX: use attempts.score (NOT score_percent)
    // We keep it very simple and robust: last 10 attempts per pupil will be derived in JS.
    let attempts = [];
    if (pupilIds.length) {
      const { data: att, error: attErr } = await supabaseAdmin
        .from("attempts")
        .select("id, student_id, created_at, score")
        .in("student_id", pupilIds)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (attErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load attempts",
          debug: attErr.message,
        });
      }
      attempts = att || [];
    }

    // 5) Build per-pupil summaries
    const attemptsByStudent = new Map();
    for (const a of attempts) {
      if (!attemptsByStudent.has(a.student_id)) attemptsByStudent.set(a.student_id, []);
      attemptsByStudent.get(a.student_id).push(a);
    }

    function safeScore(x) {
      // score should already be a % number (0-100). Keep it safe.
      const n = Number(x);
      return Number.isFinite(n) ? Math.round(n) : null;
    }

    const rows = (pupils || []).map((p) => {
      const list = attemptsByStudent.get(p.id) || [];

      const latest = list[0] ? safeScore(list[0].score) : null;

      // "Recent" = show last 3 as "80%, 92%, 71%"
      const recent = list.slice(0, 3).map((x) => safeScore(x.score)).filter((v) => v !== null);
      const recent_text = recent.length ? recent.map((v) => `${v}%`).join(", ") : "—";

      return {
        id: p.id,
        first_name: p.first_name || null,
        surname: null, // you can add this later once the DB has a surname column
        class_label: p.class_label || cls.class_label,
        attempt_count: list.length,
        latest_score: latest,
        recent_text,
      };
    });

    // 6) Concerns: ≤ 70%
    const concerns = rows
      .filter((r) => r.latest_score !== null && r.latest_score <= 70)
      .sort((a, b) => (a.latest_score ?? 999) - (b.latest_score ?? 999));

    if (debug === "1") {
      return res.json({
        ok: true,
        me,
        class: cls,
        pupils_count: pupils?.length || 0,
        attempts_count: attempts.length,
        sample_attempt: attempts[0] || null,
        rows: rows.slice(0, 5),
        concerns: concerns.slice(0, 5),
        note: "This endpoint uses attempts.score. If you still see errors, open /api/teacher/class_overview?class_label=M4&debug=1 and send me sample_attempt.",
      });
    }

    return res.json({ ok: true, class: cls, rows, concerns });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
