// pages/api/teacher/settings.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// --- tiny cookie parser ---
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function looksLikeUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

// Try hard to find a teacher session value from cookies (different versions used different names)
function getTeacherSessionValue(req) {
  const c = parseCookies(req);

  // common cookie names we might have used
  const candidates = [
    c.bmtt_teacher_id,
    c.bmtt_teacher,
    c.bmtt_teacher_session,
    c.teacher_id,
    c.teacher,
  ].filter(Boolean);

  if (candidates.length) return candidates[0];

  // last resort: any cookie containing "teacher"
  for (const [k, v] of Object.entries(c)) {
    if (k.toLowerCase().includes("teacher") && v) return v;
  }

  return null;
}

async function getLoggedInTeacher(req) {
  const raw = getTeacherSessionValue(req);
  if (!raw) return { loggedIn: false };

  // raw could be UUID, JSON, or something else
  let teacherId = null;
  let email = null;

  if (looksLikeUUID(raw)) {
    teacherId = raw;
  } else {
    // try JSON
    try {
      const parsed = JSON.parse(raw);
      teacherId = parsed?.id || parsed?.teacherId || null;
      email = parsed?.email || null;
    } catch {
      // try if it's an email
      if (String(raw).includes("@")) email = raw;
    }
  }

  let teacher = null;

  if (teacherId) {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("id", teacherId)
      .maybeSingle();
    if (error) return { loggedIn: false, error: error.message };
    teacher = data;
  } else if (email) {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("email", email)
      .maybeSingle();
    if (error) return { loggedIn: false, error: error.message };
    teacher = data;
  }

  if (!teacher?.id) return { loggedIn: false };

  // load classes this teacher can access
  const { data: classes, error: cErr } = await supabase
    .from("teacher_classes")
    .select("class_label")
    .eq("teacher_id", teacher.id);

  // admins can access everything
  let allowedClasses = classes || [];
  if (teacher.role === "admin") {
    const { data: all, error: allErr } = await supabase
      .from("classes")
      .select("class_label, year_group")
      .order("year_group", { ascending: true });
    if (!allErr && all) allowedClasses = all;
  }

  if (cErr) {
    // even if teacher_classes fails, still treat as logged in (admin screens may still work)
    return { loggedIn: true, teacher, classes: [] };
  }

  return { loggedIn: true, teacher, classes: allowedClasses };
}

function normaliseClassLabel(v) {
  return String(v || "").trim().toUpperCase().replace(/\s+/g, "");
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normaliseTables(arr) {
  const nums = (Array.isArray(arr) ? arr : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 19)
    .map((n) => Math.round(n));
  const uniq = Array.from(new Set(nums)).sort((a, b) => a - b);
  return uniq.length ? uniq : Array.from({ length: 19 }, (_, i) => i + 1);
}

export default async function handler(req, res) {
  try {
    const auth = await getLoggedInTeacher(req);
    if (!auth.loggedIn) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    const teacher = auth.teacher;

    if (req.method === "GET") {
      const class_label = normaliseClassLabel(req.query.class_label);
      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      // teacher can only read settings for their class unless admin
      const allowed = teacher.role === "admin"
        ? true
        : (auth.classes || []).some((c) => normaliseClassLabel(c.class_label) === class_label);

      if (!allowed) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }

      const { data, error } = await supabase
        .from("teacher_settings")
        .select("teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at")
        .eq("teacher_id", teacher.id)
        .eq("class_label", class_label)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ ok: false, error: "Failed to load settings", details: error.message });
      }

      const defaults = {
        question_count: 25,
        seconds_per_question: 6,
        tables_selected: Array.from({ length: 19 }, (_, i) => i + 1),
      };

      return res.status(200).json({
        ok: true,
        loggedIn: true,
        teacher: { id: teacher.id, email: teacher.email, role: teacher.role },
        settings: data
          ? {
              question_count: data.question_count ?? defaults.question_count,
              seconds_per_question: data.seconds_per_question ?? defaults.seconds_per_question,
              tables_selected: data.tables_selected ?? defaults.tables_selected,
              class_label,
            }
          : { ...defaults, class_label },
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const class_label = normaliseClassLabel(body.class_label);
      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      const allowed = teacher.role === "admin"
        ? true
        : (auth.classes || []).some((c) => normaliseClassLabel(c.class_label) === class_label);

      if (!allowed) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }

      const question_count = clampInt(body.question_count, 10, 60, 25);
      const seconds_per_question = clampInt(body.seconds_per_question, 3, 6, 6);
      const tables_selected = normaliseTables(body.tables_selected);

      const row = {
        teacher_id: teacher.id,
        class_label,
        question_count,
        seconds_per_question,
        tables_selected,
        updated_at: new Date().toISOString(),
      };

      // upsert requires a unique constraint on (teacher_id, class_label)
      const { data, error } = await supabase
        .from("teacher_settings")
        .upsert(row, { onConflict: "teacher_id,class_label" })
        .select("teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at")
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to save settings",
          details: error.message,
        });
      }

      return res.status(200).json({ ok: true, loggedIn: true, settings: data });
    }

    return res.status(405).json({ ok: false, error: "Use GET or POST" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
