// pages/api/student/login.js
// Student login: verifies username + PIN, then sets bmtt_student cookie

const { serialize } = require("cookie");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE env vars. Need NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

module.exports = async function handler(req, res) {
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
      return res.status(400).json({
        ok: false,
        error: "Missing username or pin",
      });
    }

    const supabase = getSupabaseAdmin();

    // Try to load pupil record
    // We support either pin_hash (recommended) or pin (legacy/plain)
    const { data: pupil, error } = await supabase
      .from("pupils")
      .select(
        "id, first_name, last_name, class_id, class_label, username, pin_hash, pin"
      )
      .eq("username", String(username).trim())
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!pupil) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    const pinStr = String(pin).trim();

    // Check pin in a flexible way
    let pinOk = false;

    // If bcrypt hash exists
    if (pupil.pin_hash && typeof pupil.pin_hash === "string") {
      // bcrypt hashes usually start with $2
      if (pupil.pin_hash.startsWith("$2")) {
        pinOk = await bcrypt.compare(pinStr, pupil.pin_hash);
      } else {
        // If it’s not bcrypt, fall back to direct compare
        pinOk = pinStr === String(pupil.pin_hash);
      }
    } else if (pupil.pin != null) {
      pinOk = pinStr === String(pupil.pin);
    }

    if (!pinOk) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    const fullName = `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim();

    // IMPORTANT: class_label might be stored on pupils OR derived elsewhere.
    // If your pupils table does NOT have class_label, we still set null and your /api/student/settings can derive later.
    const session = {
      pupil_id: pupil.id,
      pupilId: pupil.id,
      username: pupil.username,
      full_name: fullName,
      fullName,
      class_label: pupil.class_label || null,
      classLabel: pupil.class_label || null,
      class_id: pupil.class_id || null,
      classId: pupil.class_id || null,
      role: "student",
    };

    const cookie = serialize("bmtt_student", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });

    res.setHeader("Set-Cookie", cookie);

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
};
