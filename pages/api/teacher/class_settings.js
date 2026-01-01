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

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function normalizeSeconds(v) {
  const n = Number(v);
  const allowed = [3, 6, 9, 12];
  return allowed.includes(n) ? n : 6;
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

    // --- Determine which class we are allowed to manage ---
    // Admin: may specify class_label via query or body
    // Teacher: must be their assigned class (from teacher_classes table)
    let class_label = null;

    if (role === "admin") {
      class_label =
        (req.method === "GET" ? req.query.class_label : req.body?.class_label) ||
        null;
      if (!class_label) {
        return res.status(400).json({
          ok: false,
          error: "Missing class_label",
          example: "/api/teacher/class_settings?class_label=B3",
        });
      }
    } else {
      // Teacher: lookup their class_id then class_label
      const { data: link, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher_id)
        .maybeSingle();

      if (linkErr) {
        return res
          .status(500)
          .json({ ok: false, error: "Failed to load teacher class", debug: linkErr.message });
      }
      if (!link?.class_id) {
        return res.status(403).json({
          ok: false,
          error: "No class assigned to this teacher",
        });
      }

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("class_label")
        .eq("id", link.class_id)
        .maybeSingle();

      if (clsErr) {
        return res
          .status(500)
          .json({ ok: false, error: "Failed to load class", debug: clsErr.message });
      }
      class_label = cls?.class_label || null;
      if (!class_label) {
        return res.status(404).json({ ok: false, error: "Class not found" });
      }
    }

    if (req.method === "GET") {
      const { data: cls, error } = await supabase
        .from("classes")
        .select("*")
        .eq("class_label", class_label)
        .maybeSingle();

      if (error) {
        return res
          .status(500)
          .json({ ok: false, error: "Failed to load class", debug: error.message });
      }
      if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

      return res.json({
        ok: true,
        class_label,
        settings: {
          min_table: cls.min_table ?? null,
          max_table: cls.max_table ?? null,
          test_start_date: cls.test_start_date ?? null,
          question_count: cls.question_count ?? cls.num_questions ?? 25,
          seconds_per_question: cls.seconds_per_question ?? 6,
        },
      });
    }

    if (req.method === "POST") {
      const qc = clampInt(req.body?.question_count, 10, 60, 25);
      const spq = normalizeSeconds(req.body?.seconds_per_question);

      const patch = {
        question_count: qc,
        seconds_per_question: spq,
        // keep old column in sync if it exists in your table
        num_questions: qc,
      };

      const { data, error } = await supabase
        .from("classes")
        .update(patch)
        .eq("class_label", class_label)
        .select("*")
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to update class settings",
          debug: error.message,
        });
      }

      return res.json({
        ok: true,
        message: "Saved",
        class_label,
        settings: {
          question_count: data?.question_count ?? qc,
          seconds_per_question: data?.seconds_per_question ?? spq,
        },
      });
    }

    return res.status(405).json({ ok: false, error: "Use GET or POST" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
