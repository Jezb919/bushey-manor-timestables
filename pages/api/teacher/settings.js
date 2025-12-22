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

function looksLikeUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

// decode bmtt_session payload (no verify) to read teacher_id
function decodeSessionTeacherId(bmtt_session) {
  try {
    const parts = String(bmtt_session || "").split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64.padEnd(Math.ceil(payloadB64.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);
    const id = payload.teacher_id || payload.teacherId || payload.id || null;
    return looksLikeUUID(id) ? id : null;
  } catch {
    return null;
  }
}

function getTeacherIdFromCookies(req) {
  const c = parseCookies(req);

  // 1) bmtt_teacher (your cookie)
  if (c.bmtt_teacher) {
    try {
      const parsed = JSON.parse(c.bmtt_teacher);
      const id = parsed?.teacherId || parsed?.teacher_id || parsed?.id || null;
      if (looksLikeUUID(id)) return id;
    } catch {}
  }

  // 2) bmtt_session
  if (c.bmtt_session) {
    const id = decodeSessionTeacherId(c.bmtt_session);
    if (id) return id;
  }

  return null;
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

async function getTeacher(req) {
  const teacherId = getTeacherIdFromCookies(req);
  if (!teacherId) return { loggedIn: false };

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, email, full_name, role")
    .eq("id", teacherId)
    .maybeSingle();

  if (error || !teacher?.id) return { loggedIn: false };
  return { loggedIn: true, teacher };
}

// IMPORTANT: permission check directly in DB
async function isAllowedForClass(teacherId, role, classLabel) {
  if (role === "admin") return true;
  if (!teacherId) return false;

  const wanted = normaliseClassLabel(classLabel);

  // First try: teacher_classes has class_label
  const r1 = await supabase
    .from("teacher_classes")
    .select("id, class_label")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  // If the table doesn't have class_label, Supabase will error; ignore and try alternative
  if (!r1.error) {
    // If teacher_classes stores one row per teacher per class, we need to search all rows, not maybeSingle
    const rAll = await supabase
      .from("teacher_classes")
      .select("class_label")
      .eq("teacher_id", teacherId);

    if (!rAll.error) {
      return (rAll.data || []).some(
        (row) => normaliseClassLabel(row.class_label) === wanted
      );
    }
  }

  // Second try: teacher_classes stores class_id instead
  // join by looking up class id from classes table
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("id, class_label")
    .eq("class_label", wanted)
    .maybeSingle();

  if (clsErr || !cls?.id) return false;

  const { data: tc2, error: tc2Err } = await supabase
    .from("teacher_classes")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("class_id", cls.id)
    .maybeSingle();

  if (tc2Err) return false;
  return !!tc2;
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

      const allowed = await isAllowedForClass(
        teacher.id,
        teacher.role,
        class_label
      );

      if (!allowed) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this class",
          debug: { teacher_id: teacher.id, role: teacher.role, class_label },
        });
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
              class_label,
              question_count: data.question_count ?? defaults.question_count,
              seconds_per_question:
                data.seconds_per_question ?? defaults.seconds_per_question,
              tables_selected: data.tables_selected ?? defaults.tables_selected,
              updated_at: data.updated_at ?? null,
            }
          : { class_label, ...defaults },
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const class_label = normaliseClassLabel(body.class_label);
      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      const allowed = await isAllowedForClass(
        teacher.id,
        teacher.role,
        class_label
      );

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
