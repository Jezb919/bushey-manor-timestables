import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// pick first existing value from possible keys
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return null;
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
      if (!email) {
        return res.status(400).json({ ok: false, error: "Missing email for debug" });
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
        return res.status(404).json({ ok: false, error: "No teacher found for that email" });
      }

      // show columns (NOT password values)
      const keys = Object.keys(teacher);

      // show which password-like columns exist
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
        note:
          "This does NOT show any password values. It only lists which columns exist so we can log in correctly.",
      });
    }

    // Normal login
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({ ok: false, error: "Missing email or password" });
    }

    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
    }

    if (!teacher) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // ✅ Try multiple possible password fields (because your schema has changed a few times)
    // IMPORTANT: This expects the stored value is plain-text (same as students PIN style).
    // If it’s a bcrypt hash, we’ll handle that in the next step.
    const storedPassword = pick(teacher, [
      "password",
      "pass",
      "passwd",
      "plain_password",
      "temp_password",
      "password_hash", // sometimes used even when not hashed
      "pin", // some setups used pin
    ]);

    if (!storedPassword) {
      return res.status(500).json({
        ok: false,
        error: "Teacher account has no password field we can verify",
        debug: {
          teacherKeys: Object.keys(teacher),
          tip: "Run GET /api/teacher/login?debug=1&email=YOUR_EMAIL to see password-like columns.",
        },
      });
    }

    // Compare as strings
    if (String(storedPassword) !== String(password)) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Set cookie session
    const session = {
      teacher_id: teacher.id,
      role: teacher.role,
      email: teacher.email,
      full_name: teacher.full_name,
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
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
