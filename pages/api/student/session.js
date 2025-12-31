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
    const cookies = parseCookies(req.headers.cookie || "");
    const raw = cookies.bmtt_student;

    if (!raw) {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    const studentId = session.studentId || session.student_id;
    const class_id = session.class_id || null;
    const username = session.username || null;

    if (!studentId) {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    let class_label = session.class_label || null;

    // If class_label missing, look it up using classes table + class_id
    if (!class_label && class_id) {
      const supabase = getSupabaseAdmin();
      const { data: cls, error } = await supabase
        .from("classes")
        .select("id, class_label")
        .eq("id", class_id)
        .maybeSingle();
      if (!error && cls) class_label = cls.class_label || null;
    }

    return res.status(200).json({
      ok: true,
      signedIn: true,
      session: {
        studentId,
        class_id,
        class_label,
        username,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
