// pages/api/teacher/class_overview.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import requireTeacher from "../../../lib/requireTeacher";

// Helper: classes table sometimes uses class_label, sometimes label.
// This makes it work either way.
function getClassLabel(row) {
  return row?.class_label || row?.label || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed (GET only)" });
    }

    const me = await requireTeacher(req, res); // must return { teacher_id, role, ... }
    if (!me) return; // requireTeacher should already respond

    const class_label = String(req.query.class_label || "").trim();
    const debug = String(req.query.debug || "") === "1";

    if (!class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    // 1) Find class row by label (works whether DB uses class_label or label)
    const { data: classRows, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id,class_label,label")
      .or(`class_label.eq.${class_label},label.eq.${class_label}`)
      .limit(1);

    if (classErr) {
      return res.status(500).json({ ok: false, error: "Failed to load class", debug: classErr.message });
    }
    const classRow = classRows?.[0];
    if (!classRow) {
      return res.status(404).json({ ok: false, error: "Class not found", debug: class_label });
    }

    const classId = classRow.id;

    // 2) Permission check:
    // Admin can see all classes. Teachers must be linked in teacher_classes by class_id.
    if (me.role !== "admin") {
      const { data: linkRows, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("id")
        .eq("teacher_id", me.teacher_id)
        .eq("class_id", classId)
        .limit(1);

      if (linkErr) {
        return res.status(403).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!linkRows?.length) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }
    }

    // 3) Load pupils for that class
    const { data: pupils, error: pupilsErr } = await supabaseAdmin
      .from("students")
      .select("id,first_name,last_name,username,class_id")
      .eq("class_id", classId)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: pupilsErr.message });
    }

    const pupilIds = (pupils || []).map((p) => p.id);

    // 4) Load attempts for those pupils (latest + count)
    let attempts = [];
    if (pupilIds.length) {
      const { data: attemptsData, error: attemptsErr } = await supabaseAdmin
        .from("attempts")
        .select("id,student_id,created_at,score,score_percent")
        .in("student_id", pupilIds)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (attemptsErr) {
        return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attemptsErr.message });
      }
      attempts = attemptsData || [];
    }

    // 5) Build stats per pupil
    const byStudent = new Map();
    for (const a of attempts) {
      const sid = a.student_id;
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid).push(a);
    }

    const rows = (pupils || []).map((p) => {
      const list = byStudent.get(p.id) || [];
      const latest = list[0] || null;

      // score can be in "score" (0-100) OR "score_percent"
      const latestScore =
        latest?.score_percent ?? latest?.score ?? null;

      return {
        pupil_id: p.id,
        pupil_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "(no name)",
        first_name: p.first_name,
        last_name: p.last_name,
        username: p.username,
        latest_score: latestScore,
        attempts: list.length,
        recent: list.slice(0, 5).map((x) => x.score_percent ?? x.score ?? null),
      };
    });

    return res.status(200).json({
      ok: true,
      class: { id: classId, class_label: getClassLabel(classRow) || class_label },
      rows,
      debug: debug
        ? {
            teacher: { role: me.role, teacher_id: me.teacher_id },
            pupils: pupils?.length || 0,
            attempts: attempts.length,
          }
        : undefined,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
