// pages/api/teacher/login.js
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Simple HMAC-signed cookie session (no extra libraries)
const COOKIE_NAME = "bmtt_session";

function signSession(payloadObj) {
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function setCookie(res, value) {
  // 7 days
  const maxAge = 60 * 60 * 24 * 7;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const { email, password } = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");

  if (!e || !p) {
    return res.status(400).json({ ok: false, error: "Missing email or password" });
  }

  try {
    // Get teacher record
    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("id, email, full_name, role, password_hash")
      .eq("email", e)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "DB error", details: error.message });
    }

    if (!teacher) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Verify password in Postgres using crypt()
    const { data: checkData, error: checkErr } = await supabase.rpc("bmtt_check_teacher_password", {
      teacher_id: teacher.id,
      plain_password: p,
    });

    if (checkErr) {
      return res.status(500).json({
        ok: false,
        error: "Password check failed",
        details: checkErr.message,
      });
    }

    if (!checkData) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Set cookie session
    const session = signSession({
      teacher_id: teacher.id,
      role: teacher.role,
      email: teacher.email,
      full_name: teacher.full_name,
      iat: Date.now(),
    });

    setCookie(res, session);

    return res.status(200).json({
      ok: true,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        full_name: teacher.full_name,
        role: teacher.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error", details: String(err?.message || err) });
  }
}
