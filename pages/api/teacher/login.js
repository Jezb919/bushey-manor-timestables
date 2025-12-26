import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function setAuthCookies(res, payloadObj) {
  const payload = encodeURIComponent(JSON.stringify(payloadObj));

  // Clear old cookies on both paths (fixes “works in incognito, not normal”)
  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  const clearBase = `Max-Age=0; Expires=${expire}; SameSite=Lax`;

  // Set fresh cookie on BOTH paths (belt + braces)
  // IMPORTANT: Path=/ makes it available to /api/teacher/me
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const setBase = `Max-Age=${maxAge}; SameSite=Lax`;

  res.setHeader("Set-Cookie", [
    // clear
    `bmtt_teacher=; Path=/; ${clearBase}`,
    `bmtt_teacher=; Path=/teacher; ${clearBase}`,
    `bmtt_session=; Path=/; ${clearBase}`,
    `bmtt_session=; Path=/teacher; ${clearBase}`,

    // set
    `bmtt_teacher=${payload}; Path=/; ${setBase}`,
    `bmtt_teacher=${payload}; Path=/teacher; ${setBase}`,
  ]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Missing email or password" });
    }

    // Load teacher record
    const { data: t, error } = await supabaseAdmin
      .from("teachers")
      .select("id, email, full_name, role, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, error: "DB error", debug: error.message });
    if (!t) return res.status(401).json({ ok: false, error: "Invalid login" });

    // Your project currently uses plain compare (based on your earlier debug)
    const ok = String(password) === String(t.password_hash || "");
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid login" });

    // Store what your app expects in the cookie
    const payload = {
      teacherId: t.id,
      teacher_id: t.id,
      role: t.role,
      email: t.email,
      full_name: t.full_name || "",
    };

    setAuthCookies(res, payload);

    return res.json({ ok: true, user: { id: t.id, email: t.email, role: t.role, full_name: t.full_name || "" } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
