// pages/api/student/login.js
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { username, pin }",
      });
    }

    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return res.status(400).json({ ok: false, error: "Missing username or pin" });
    }

    const supabase = getSupabaseAdmin();

    const { data: pupil, error } = await supabase
      .from("pupils")
      .select("id, first_name, last_name, class_id, class_label, username, pin")
      .eq("username", String(username).trim())
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, error: error.message });
    if (!pupil) return res.status(401).json({ ok: false, error: "Invalid login" });

    const pinOk = String(pin).trim() === String(pupil.pin ?? "").trim();
    if (!pinOk) return res.status(401).json({ ok: false, error: "Invalid login" });

    const fullName = `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();

    const session = {
      role: "student",
      pupil_id: pupil.id,
      pupilId: pupil.id,
      username: pupil.username,
      full_name: fullName,
      fullName,
      class_label: pupil.class_label || null,
      classLabel: pupil.class_label || null,
      class_id: pupil.class_id || null,
      classId: pupil.class_id || null,
    };

    setCookie(res, "bmtt_student", JSON.stringify(session), {
      path: "/",
      sameSite: "Lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });

    return res.status(200).json({
      ok: true,
      pupil: {
        id: pupil.id,
        username: pupil.username,
        full_name: fullName,
        class_label: pupil.class_label || null,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e && e.stack ? e.stack : e),
    });
  }
}
