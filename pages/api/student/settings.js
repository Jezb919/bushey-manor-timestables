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

    // IMPORTANT: select("*") so we don't crash if column names differ
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

    // Try multiple possible column names (in case yours differ)
    const classLabel = pick(cls, ["class_label", "classLabel", "label"]);
    const minTable = pick(cls, ["minimum_table", "min_table", "minimumTable", "minTable"]);
    const maxTable = pick(cls, ["maximum_table", "max_table", "maximumTable", "maxTable"]);
    const startDate = pick(cls, ["test_start_date", "testStartDate", "start_date", "startDate"]);

    return res.status(200).json({
      ok: true,
      signedIn: true,
      settings: {
        class_id: cls.id,
        class_label: classLabel,
        minimum_table: minTable,
        maximum_table: maxTable,
        test_start_date: startDate,
      },
      debug: {
        // helps us confirm what your real columns are
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
