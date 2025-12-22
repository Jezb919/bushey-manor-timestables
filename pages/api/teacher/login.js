// pages/api/teacher/login.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function setCookie(res, name, value, options = {}) {
  const parts = [];
  parts.push(`${name}=${value}`);
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const { email, password } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanEmail || !cleanPassword) {
    return res.status(400).json({ ok: false, error: "Missing email or password" });
  }

  // Load teacher row
  const { data: teacher, error: teacherErr } = await supabase
    .from("teachers")
    .select("id, email, full_name, role, password_hash")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (teacherErr) {
    return res.status(500).json({
      ok: false,
      error: "Failed to load teacher",
      details: teacherErr.message,
    });
  }

  if (!teacher) {
    return res.status(401).json({ ok: false, error: "Invalid login" });
  }

  // Verify password using pgcrypto crypt()
  const { data: check, error: checkErr } = await supabase.rpc("verify_teacher_password", {
    p_teacher_id: teacher.id,
    p_password: cleanPassword,
  });

  if (checkErr) {
    return res.status(500).json({
      ok: false,
      error: "Password verify failed",
      details: checkErr.message,
    });
  }

  if (!check) {
    return res.status(401).json({ ok: false, error: "Invalid login" });
  }

  // Set cookie: store RAW JSON so /api/teacher/me can JSON.parse it
  const cookieValue = JSON.stringify({ teacherId: teacher.id });

  setCookie(res, "bmtt_teacher", cookieValue, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res.status(200).json({
    ok: true,
    teacher: { id: teacher.id, email: teacher.email, full_name: teacher.full_name, role: teacher.role },
  });
}
