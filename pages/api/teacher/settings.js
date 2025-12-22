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

function looksLikeUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
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

// --- decode bmtt_session (JWT-ish) payload without verifying (fine for lookup) ---
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

  // 1) Preferred: bmtt_teacher cookie (your system sets this)
  // Example value (decoded): {"teacherId":"bae1d975-..."}
  if (c.bmtt_teacher) {
    try {
      const parsed = JSON.parse(c.bmtt_teacher);
      const id = parsed?.teacherId || parsed?.teacher_id || parsed?.id || null;
      if (looksLikeUUID(id)) return id;
    } catch {
      // ignore
    }
  }

  // 2) Fallback: bmtt_session token contains teacher_id
  if (c.bmtt_session) {
    const id = decodeSessionTeacherId(c.bmtt_session);
    if (id) return id;
  }

  return null;
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

  // load classes this teacher can access
  const { data: classes, error: cErr } = await supabase
    .from("teacher_classes")
    .select("class_label, year_group")
    .eq("teacher_id", teacher.id);

  // admin can access all classes
  if (teacher.role === "admin") {
    const { data: allClasses } = await supabase
      .from("classes")
      .select("class_label, year_group")
      .order("year_group", { ascending: true });
    return { loggedIn: true, teacher, classes: allClasses || [] };
  }

  return { loggedIn: true, teacher, classes: cErr ? [] : classes || [] };
}

function teacherHasClass(auth, classLabel) {
  if (!auth?.teacher) return false;
  if (auth.teacher.role === "admin") return true;
  const list = auth.classes || [];
  return list.some(
    (c) => normaliseClassLabel(c.class_label) === normaliseClassLabel(classLabel)
  );
}

export default async function handler(req, res) {
  try {
    const auth = await getTeacher(req);
    if (!auth.loggedIn) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    if (req.method === "GET") {
      const class_label = normaliseClassLabel(req.query.class_label);
      if (!class_label) {
        return res.status(400).json({ ok: false, error: "Missing class_label" });
      }

      if (!teacherHasClass(auth, class_label)) {
        return res
          .status(403)
          .json({ ok: false, error: "Not allowed for this class" });
      }

      const { data, error } = await supabase
        .from("teacher_settings")
        .select(
          "teacher_id, class_label, question_count, seconds_per_question, tables_selected, updated_at"
        )
        .eq("teacher_id", auth.teacher.id)
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
        teacher: {
          id: auth.teacher.id,
          email: auth.teacher.email,
          role: auth.teacher.role,
        },
        classes: auth.classes || [],
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

      if (!teacherHasClass(auth, class_label)) {
        return res
          .status(403)
          .json({ ok: false, error: "Not allowed for this class" });
      }

      const question_count = clampInt(body.question_count, 10, 60, 25);
      const seconds_per_question = clampInt(body.seconds_per_question, 3, 6, 6);
      const tables_selected = normaliseTables(body.tables_selected);

      const row = {
        teacher_id: auth.teacher.id,
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
