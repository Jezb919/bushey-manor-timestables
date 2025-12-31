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

    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, class_label, minimum_table, maximum_table, test_start_date")
      .eq("id", class_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
    }
    if (!cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    return res.status(200).json({
      ok: true,
      signedIn: true,
      settings: {
        class_id: cls.id,
        class_label: cls.class_label,
        minimum_table: cls.minimum_table,
        maximum_table: cls.maximum_table,
        test_start_date: cls.test_start_date, // keep as-is (string/date)
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
