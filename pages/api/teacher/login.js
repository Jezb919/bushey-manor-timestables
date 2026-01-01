// pages/api/teacher/login.js
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push("Secure");

  // allow multiple set-cookie headers
  const prev = res.getHeader("Set-Cookie");
  const next = prev ? ([]).concat(prev, parts.join("; ")) : parts.join("; ");
  res.setHeader("Set-Cookie", next);
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();

  try {
    // Helpful debug endpoint:
    // /api/teacher/login?debug=1&email=admin@busheymanor.local&password=admin123
    if (req.method === "GET") {
      const debug = req.query?.debug === "1";
      if (!debug) {
        return res.status(200).json({
          ok: true,
          info: "POST only. Debug: add ?debug=1&email=...&password=...",
        });
      }

      const email = String(req.query?.email || "").trim();
      const password = String(req.query?.password || "");

      if (!email) return res.status(400).json({ ok: false, error: "Missing email for debug" });
      if (!password) return res.status(400).json({ ok: false, error: "Missing password for debug" });

      const { data: teacher, error } = await supabase
        .from("teachers")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

      if (error) return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
      if (!teacher) return res.status(404).json({ ok: false, error: "No teacher found for that email" });

      const hasHash = !!teacher.password_hash;
      let match = false;
      if (teacher.password_hash) {
        match = await bcrypt.compare(password, String(teacher.password_hash));
      }

      return res.status(200).json({
        ok: true,
        email: teacher.email,
        role: teacher.role,
        has_password_hash: hasHash,
        password_matches_hash: match,
        note: "No password values are shown.",
      });
    }

    // Normal login (POST)
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { email, password }",
      });
    }

    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Missing email or password" });
    }

    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
    }
    if (!teacher) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    if (!teacher.password_hash) {
      return res.status(401).json({
        ok: false,
        error: "No password set for this account (ask admin to send setup link / reset password).",
      });
    }

    const ok = await bcrypt.compare(password, String(teacher.password_hash));
    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Create cookie session
    const session = {
      teacher_id: teacher.id,
      role: teacher.role,
      email: teacher.email,
      full_name: teacher.full_name,
      class_label: teacher.class_label || null,
    };

    setCookie(res, "bmtt_teacher", JSON.stringify(session), {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res.status(200).json({
      ok: true,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        role: teacher.role,
        full_name: teacher.full_name,
        class_label: teacher.class_label || null,
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
