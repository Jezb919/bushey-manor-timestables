import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);

  // Default cookie settings (safe + works in Vercel)
  parts.push(`Path=${opts.path || "/"}`);
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);

  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);

  // NOTE: Domain not set (lets Vercel handle it safely)
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const { email, password } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({ ok: false, error: "Missing email or password" });
    }

    // Look up teacher
    const { data: teacher, error } = await supabaseAdmin
      .from("teachers")
      .select("id, email, role, password_hash, full_name")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "DB error", debug: error.message });
    }

    if (!teacher) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // ✅ Plain-text check (matches what your DB currently contains: "admin123")
    // Later we can upgrade this to hashed verification.
    const stored = teacher.password_hash ? String(teacher.password_hash) : "";
    if (!stored || stored !== cleanPassword) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Build session payload
    const payload = {
      teacherId: teacher.id,
      teacher_id: teacher.id, // include both keys (your app uses both in places)
      role: teacher.role || "teacher",
      email: teacher.email,
      full_name: teacher.full_name || null,
    };

    // Set cookie (NOT httpOnly so your existing front-end code can read it if needed)
    // If you want more security later, we can make it httpOnly and adjust reads.
    setCookie(res, "bmtt_teacher", JSON.stringify(payload), {
      path: "/",
      sameSite: "Lax",
      secure: true, // on Vercel https this is correct
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res.json({ ok: true, teacher: { id: teacher.id, role: payload.role, email: teacher.email } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
