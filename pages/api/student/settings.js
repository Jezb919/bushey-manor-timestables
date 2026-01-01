import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
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

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return null;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res
        .status(405)
        .json({ ok: false, error: "Method not allowed (GET only)" });
    }

    const cookies = parseCookies(req.headers.cookie || "");
    const raw = cookies.bmtt_student;
    if (!raw) return res.status(200).json({ ok: true, signedIn: false });

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    const class_id = session.class_id || null;

    if (!class_id) {
      return res.status(200).json({
        ok: true,
        signedIn: true,
        settings: null,
        warning: "No class_id in session",
      });
    }

    const supabase = getSupabaseAdmin();

    // select("*") so we don't crash if column names differ
    const { data: cls, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", class_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Server error",
        debug: error.message,
      });
    }

    if (!cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // Your real column names (based on your debug):
    // class_label, min_table, max_table, test_start_date
    const classLabel = pick(cls, ["class_label", "classLabel", "label"]);
    const minTable = pick(cls, [
      "min_table",
      "minimum_table",
      "minimumTable",
      "minTable",
    ]);
    const maxTable = pick(cls, [
      "max_table",
      "maximum_table",
      "maximumTable",
      "maxTable",
    ]);
    const startDate = pick(cls, [
      "test_start_date",
      "testStartDate",
      "start_date",
      "startDate",
    ]);

    // NEW: question count + seconds per question
    const questionCount = pick(cls, ["question_count", "questionCount"]);
    const secondsPerQuestion = pick(cls, [
      "seconds_per_question",
      "secondsPerQuestion",
    ]);

    return res.status(200).json({
      ok: true,
      signedIn: true,
      settings: {
        class_id: cls.id,
        class_label: classLabel,

        // Keep these keys as minimum_/maximum_ because your student pages already read them
        minimum_table: toIntOrNull(minTable),
        maximum_table: toIntOrNull(maxTable),

        test_start_date: startDate || null,

        // NEW settings used by the test runner
        question_count: toIntOrNull(questionCount) ?? 25,
        seconds_per_question: toIntOrNull(secondsPerQuestion) ?? 6,
      },
      debug: {
        classKeys: Object.keys(cls),
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
