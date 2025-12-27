import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return null;
  return decodeURIComponent(found.split("=").slice(1).join("="));
}

function getTeacherFromCookie(req) {
  const token = parseCookie(req, "bmtt_teacher");
  if (!token) return null;

  // Your bmtt_teacher cookie is JSON (not JWT)
  try {
    const obj = JSON.parse(token);
    const teacher_id = obj.teacher_id || obj.teacherId;
    const role = obj.role || "teacher";
    const email = obj.email || "";
    const full_name = obj.full_name || obj.fullName || "";
    if (!teacher_id) return null;
    return { teacher_id, role, email, full_name };
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

    const session = getTeacherFromCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // 1) Look up class by label
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res
        .status(404)
        .json({ ok: false, error: "Class not found", debug: classErr?.message });
    }

    // 2) Permission: admin sees all; teacher must be linked in teacher_classes
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
          debug: { teacher_id: session.teacher_id, class_id: cls.id, class_label },
        });
      }
    }

    // 3) Load pupils for class (your students table uses first_name + last_name)
    const { data: pupils, error: pupilsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_label, class_id")
      .eq("class_id", cls.id)
      .order("first_name", { ascending: true });

    if (pupilsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load pupils",
        debug: pupilsErr.message,
      });
    }

    // 4) Load attempts for these pupils and compute:
    // Latest, last 5 avg, last 10 avg, attempts count
    const pupilIds = (pupils || []).map((p) => p.id);

    let attemptsByStudent = {};
    if (pupilIds.length) {
      const { data: attempts, error: attErr } = await supabaseAdmin
        .from("attempts")
        .select("id, student_id, score_percent, created_at")
        .in("student_id", pupilIds)
        .order("created_at", { ascending: false });

      if (attErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load attempts",
          debug: attErr.message,
        });
      }

      for (const a of attempts || []) {
        const sid = a.student_id;
        if (!attemptsByStudent[sid]) attemptsByStudent[sid] = [];
        attemptsByStudent[sid].push(a);
      }
    }

    function avg(list) {
      if (!list || !list.length) return null;
      const sum = list.reduce((acc, x) => acc + (Number(x.score_percent) || 0), 0);
      return Math.round((sum / list.length) * 10) / 10;
    }

    const rows = (pupils || []).map((p) => {
      const list = attemptsByStudent[p.id] || [];
      const latest = list[0] ? Number(list[0].score_percent) : null;
      const last5 = avg(list.slice(0, 5));
      const last10 = avg(list.slice(0, 10));

      return {
        id: p.id,
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "(no name)",
        latest,
        last5,
        last10,
        attempts: list.length,
      };
    });

    // Concern list: <= 70% (latest)
    const concerns = rows
      .filter((r) => r.latest !== null && r.latest <= 70)
      .sort((a, b) => (a.latest ?? 999) - (b.latest ?? 999));

    return res.json({
      ok: true,
      class: cls,
      teacher: {
        teacher_id: session.teacher_id,
        role: session.role,
        email: session.email,
        full_name: session.full_name,
      },
      concerns,
      pupils: rows,
      ...(debug
        ? {
            debug: {
              class_id: cls.id,
              class_label,
              pupil_count: rows.length,
            },
          }
        : {}),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "Server error", debug: String(e) });
  }
}
