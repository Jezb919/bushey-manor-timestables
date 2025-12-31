// pages/api/student/login.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { serialize } from "cookie";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, {
        ok: false,
        error: "Method not allowed (POST only)",
        info:
          "Send JSON: { username, pin }. Debug: POST same body to test.",
      });
    }

    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return json(res, 400, { ok: false, error: "Missing username or pin" });
    }

    // pupils table must contain username + pin_hash (or pin) depending on your schema
    // This version assumes you store pin in a column called "pin" (plain) OR "pin_hash" (hashed).
    // If you only have plain pin, keep the equality check below.
    const { data: pupil, error } = await supabaseAdmin
      .from("pupils")
      .select("id, first_name, last_name, username, class_id, pin")
      .eq("username", username.trim())
      .single();

    if (error || !pupil) {
      return json(res, 401, { ok: false, error: "Invalid username or PIN" });
    }

    const okPin = String(pupil.pin) === String(pin).trim();
    if (!okPin) {
      return json(res, 401, { ok: false, error: "Invalid username or PIN" });
    }

    // Create a small session payload
    const session = {
      pupil_id: pupil.id,
      pupilId: pupil.id,
      username: pupil.username,
      class_id: pupil.class_id,
      classId: pupil.class_id,
      name: `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim(),
    };

    // Set cookie (httpOnly so pupils can’t tamper with it)
    const cookie = serialize("bmtt_student", JSON.stringify(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    res.setHeader("Set-Cookie", cookie);
    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", debug: String(e) });
  }
}
