import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();

    // DEBUG: GET /api/teacher/login?debug=1&email=...
    if (req.method === "GET") {
      const debug = req.query?.debug === "1";
      if (!debug) {
        return res.status(200).json({
          ok: true,
          info: "POST only. Debug: add ?debug=1&email=someone@school.local",
        });
      }

      const email = String(req.query?.email || "").trim();
      if (!email) return res.status(400).json({ ok: false, error: "Missing email for debug" });

      const { data: teacher, error } = await supabase
        .from("teachers")
        .select("*")
        .ilike("email", email)
        .maybeSingle();

      if (error) return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
      if (!teacher) return res.status(404).json({ ok: false, error: "No teacher found for that email" });

      const keys = Object.keys(teacher);
      const passwordLike = keys.filter((k) =>
        ["password", "pass", "pin", "hash"].some((frag) => k.toLowerCase().includes(frag))
      );

      return res.status(200).json({
        ok: true,
        found: true,
        email: teacher.email,
        role: teacher.role,
        id: teacher.id,
        keys,
        passwordLikeColumns: passwordLike,
        note: "Does NOT show password values.",
      });
    }

    // Normal login
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim();
    const cleanPassword = String(password || "");

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ ok: false, error: "Missing email or password" });
    }

    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
    if (!teacher) return res.status(401).json({ ok: false, error: "Invalid login" });

    // Your DB uses password_hash ✅
    const hash = teacher.password_hash || null;

    // Also allow plain password field if you ever add one later
    const plain = teacher.password || teacher.pass || teacher.pin || null;

    let ok = false;

    if (hash) {
      // bcrypt compare
      ok = await bcrypt.compare(cleanPassword, String(hash));
    } else if (plain) {
      // fallback: plain-text comparison
      ok = String(plain) === cleanPassword;
    }

    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Set cookie session
    const session = {
      teacher_id: teacher.id,
      role: teacher.role,
      email: teacher.email,
      full_name: teacher.full_name,
      class_label: teacher.class_label || null,
    };

    const isProd = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      [
        `bmtt_teacher=${encodeURIComponent(JSON.stringify(session))}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        isProd ? "Secure" : null,
      ]
        .filter(Boolean)
        .join("; ")
    );

    return res.status(200).json({ ok: true, role: teacher.role });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
