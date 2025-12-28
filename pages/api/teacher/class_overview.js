// pages/api/teacher/class_overview.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// --- cookie helpers ---
function getCookie(req, name) {
  const raw = req.headers?.cookie || "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return p.slice(name.length + 1);
  }
  return null;
}

function parseTeacherSession(req) {
  const val = getCookie(req, "bmtt_teacher");
  if (!val) return { ok: false, error: "Missing bmtt_teacher cookie" };

  try {
    const decoded = decodeURIComponent(val);
    const obj = JSON.parse(decoded);

    const role = obj.role || null;
    const teacher_id = obj.teacher_id || obj.teacherId || null;

    if (!role || !teacher_id) {
      return { ok: false, error: "Invalid teacher session (missing role/teacher_id)" };
    }

    return { ok: true, role, teacher_id };
  } catch (e) {
    return { ok: false, error: "Invalid teacher session JSON" };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed (GET only)" });
    }

    const debug = String(req.query.debug || "") === "1";

    // 1) Auth from cookie (no requireTeacher dependency)
    const sess = parseTeacherSession(req);
    if (!sess.ok) {
      return res.status(401).json({ ok: false, error: "Not logged in", debug: sess.error });
    }

    const class_label = String(req.query.class_label || "").trim();
    if (!class_label) {
      return res.status(400).json({ ok: false, error: "Missing class_label" });
    }

    // 2) Find class by class_label (YOUR DB uses class_label, not label)
    const { data: classRow, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id,class_label")
      .eq("class_label", class_label)
      .maybeSingle();

    if (classErr) {
      return res.status(500).json({ ok: false, error: "Failed to load class", debug: classErr.message });
    }
    if (!classRow) {
      return res.status(404).json({ ok: false, error: "Class not found", debug: class_label });
    }

    // 3) Permission check: admin sees all, teachers must be linked in teacher_classes via class_id
    if (sess.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("id")
        .eq("teacher_id", sess.teacher_id)
        .eq("class_id", classRow.id)
        .limit(1);

      if (linkErr) {
        return res.status(403).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!link || link.length === 0) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }
    }

    // 4) Pupils in class
    const { data: pupils, error: pupilsErr } = await supabaseAdmin
      .from("students")
      .select("id,first_name,last_name,username,class_id")
      .eq("class_id", classRow.id)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: pupilsErr.message });
    }

    const pupilIds = (pupils || []).map((p) => p.id);

    // 5) Attempts (ONLY select columns that definitely exist: id, student_id, created_at, score)
    let attempts = [];
    if (pupilIds.length) {
      const { data: attemptsData, error: attemptsErr } = await supabaseAdmin
        .from("attempts")
        .select("id,student_id,created_at,score")
        .in("student_id", pupilIds)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (attemptsErr) {
        return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attemptsErr.message });
      }
      attempts = attemptsData || [];
    }

    // Group attempts by pupil
    const byStudent = new Map();
    for (const a of attempts) {
      if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, []);
      byStudent.get(a.student_id).push(a);
    }

    const rows = (pupils || []).map((p) => {
      const list = byStudent.get(p.id) || [];
      const latest = list[0] || null;

      return {
        pupil_id: p.id,
        pupil_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "(no name)",
        username: p.username,
        latest_score: latest ? latest.score : null, // score is percent
        attempts: list.length,
        recent: list.slice(0, 5).map((x) => x.score ?? null),
      };
    });

    return res.status(200).json({
      ok: true,
      class: { id: classRow.id, class_label: classRow.class_label },
      rows,
      debug: debug
        ? {
            teacher: { role: sess.role, teacher_id: sess.teacher_id },
            pupils: pupils?.length || 0,
            attempts: attempts.length,
          }
        : undefined,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
