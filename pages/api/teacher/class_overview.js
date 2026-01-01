import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getTeacherSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies.bmtt_teacher;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();
    const t = getTeacherSession(req);

    if (!t?.teacher_id && !t?.teacherId) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const teacher_id = t.teacher_id || t.teacherId;
    const role = t.role || "teacher";

    // Determine target class_label:
    // - admin: can request any class_label in query
    // - teacher: forced to their assigned class
    let class_label = null;

    if (role === "admin") {
      class_label = req.query.class_label || null;
      if (!class_label) {
        return res.status(400).json({
          ok: false,
          error: "Missing class_label",
          example: "/api/teacher/class_overview?class_label=B3",
        });
      }
    } else {
      // teacher: find their class_id then class_label
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher_id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load teacher class",
          debug: linkErr.message,
        });
      }
      if (!link?.class_id) {
        return res.status(403).json({ ok: false, error: "No class assigned" });
      }

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id, class_label")
        .eq("id", link.class_id)
        .maybeSingle();

      if (clsErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load class",
          debug: clsErr.message,
        });
      }
      class_label = cls?.class_label || null;
      if (!class_label) return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // Resolve class_id
    const { data: clsRow, error: clsRowErr } = await supabase
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .maybeSingle();

    if (clsRowErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load class",
        debug: clsRowErr.message,
      });
    }
    if (!clsRow) return res.status(404).json({ ok: false, error: "Class not found" });

    const class_id = clsRow.id;

    // Load pupils in this class
    const { data: pupils, error: pupErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, surname, username")
      .eq("class_id", class_id)
      .order("first_name", { ascending: true });

    if (pupErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load pupils",
        debug: pupErr.message,
      });
    }

    const pupilIds = (pupils || []).map((p) => p.id);

    // Load attempts for those pupils (last 1000 is plenty)
    const { data: attempts, error: attErr } = await supabase
      .from("attempts")
      .select("id, student_id, created_at, score, max_score, percent")
      .in("student_id", pupilIds.length ? pupilIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(1000);

    if (attErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load attempts",
        debug: attErr.message,
      });
    }

    // Build table rows with “recent attempts” per pupil
    const byStudent = {};
    (attempts || []).forEach((a) => {
      if (!byStudent[a.student_id]) byStudent[a.student_id] = [];
      byStudent[a.student_id].push(a);
    });

    const rows = (pupils || []).map((p) => {
      const recents = (byStudent[p.id] || []).slice(0, 5).map((a) => ({
        attempt_id: a.id,
        created_at: a.created_at,
        percent: a.percent,
        score: a.score,
        max_score: a.max_score,
      }));

      const latest = recents[0] || null;

      const lastName = p.last_name || p.surname || "";
      const pupilName = `${p.first_name || ""} ${lastName}`.trim();

      return {
        pupil_id: p.id,
        pupil_name: pupilName || p.username || "Unnamed",
        username: p.username || null,
        latest_score: latest ? Math.round(latest.percent ?? 0) : null,
        attempts: (byStudent[p.id] || []).length,
        recent: recents,
      };
    });

    return res.json({
      ok: true,
      class: { id: class_id, class_label },
      rows,
      debug: { role, teacher_id, pupils: pupils?.length || 0, attempts: attempts?.length || 0 },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
