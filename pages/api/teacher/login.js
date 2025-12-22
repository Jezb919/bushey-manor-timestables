// pages/api/teacher/login.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function setCookie(res, name, value, opts = {}) {
  const parts = [];
  parts.push(`${name}=${value}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Missing email or password" });
  }

  // Load teacher
  const { data: teacher, error: tErr } = await supabase
    .from("teachers")
    .select("id, email, full_name, role, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (tErr) {
    return res.status(500).json({ ok: false, error: "Failed to load teacher", details: tErr.message });
  }
  if (!teacher) return res.status(401).json({ ok: false, error: "Invalid login" });

  // Verify password (bcrypt via pgcrypto crypt)
  // This requires pgcrypto + password_hash column in teachers table.
  const { data: ok, error: vErr } = await supabase.rpc("verify_teacher_password", {
    p_teacher_id: teacher.id,
    p_password: password,
  });

  if (vErr) {
    return res.status(500).json({ ok: false, error: "Password verify failed", details: vErr.message });
  }
  if (!ok) return res.status(401).json({ ok: false, error: "Invalid login" });

  // IMPORTANT: cookie value must be safe characters → encode it
  const sessionJson = JSON.stringify({ teacherId: teacher.id });
  const cookieValue = encodeURIComponent(sessionJson);

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
