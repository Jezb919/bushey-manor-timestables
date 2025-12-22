// pages/api/teacher/settings.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

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

// ---- IMPORTANT: get teacher id from cookie ----
// Your login flow should be setting a cookie (commonly bmtt_teacher_id)
function getTeacherIdFromCookie(req) {
  const c = parseCookies(req);

  // Try common cookie keys (keep this list generous)
  const candidates = [
    c.bmtt_teacher_id,
    c.teacher_id,
    c.bmtt_teacher,
    c.bmtt_teacher_session,
  ].filter(Boolean);

  if (!candidates.length) return null;

  // If it looks like UUID, use it directly
  const raw = candidates[0];

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      raw
    )
  ) {
    return raw;
  }

  // If JSON, try parse
  try {
    const parsed = JSON.parse(raw);
    return parsed?.id || parsed?.teacherId || null;
  } catch {
    return null;
  }
}

async function getTeacher(req) {
  const teacherId = getTeacherIdFromCookie(req);
  if (!teacherId) return { loggedIn: false };

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, email, full_name, role")
    .eq("id", teacherId)
    .maybeSingle();

  if (error || !teacher?.id) return { loggedIn: false };
  return { loggedIn: true, teacher };
}

async function isAllowedForClass(teacher, classLabel) {
  if (!teacher?.id) return false;
  if (teacher.role === "admin") return true;

  // Check teacher_classes DIRECTLY to avoid any mismatched shapes
  const { data, error } = await supabase
    .from("teacher_classes")
    .select("id")
    .eq("teacher_id", teacher.id)
    .eq("class_label", classLabel)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export default async function handler(req, res) {
  try {
    const auth = await getTeacher(req);
    if (!auth.loggedIn) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    const teacher = auth.teacher;

    if (req.method === "GET") {
      const class_label = normaliseClassLabel(req.query.class_label);
      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      const allowed = await isAllowedForClass(teacher, class_label);
      if (!allowed) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }

      const { data, error } = await supabase
        .from("teacher_settings")
        .select(
          "teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at"
        )
        .eq("teacher_id", teacher.id)
        .eq("class_label", class_label)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load settings",
          details: error.message,
        });
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

      const allowed = await isAllowedForClass(teacher, class_label);
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

      const { data, error } = await supabase
        .from("teacher_settings")
        .upsert(row, { onConflict: "teacher_id,class_label" })
        .select(
          "teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at"
        )
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
