import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
      });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Missing email or password",
      });
    }

    const supabase = getSupabaseAdmin();

    // 🔹 Look up teacher/admin by email
    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error || !teacher) {
      return res.status(401).json({
        ok: false,
        error: "Invalid login",
      });
    }

    // 🔹 Plain-text password check (matches current system)
    if (teacher.password !== password) {
      return res.status(401).json({
        ok: false,
        error: "Invalid login",
      });
    }

    // 🔹 Create session cookie
    const session = {
      teacher_id: teacher.id,
      role: teacher.role,
      email: teacher.email,
      full_name: teacher.full_name,
    };

    res.setHeader(
      "Set-Cookie",
      `bmtt_teacher=${encodeURIComponent(JSON.stringify(session))}; Path=/; HttpOnly; SameSite=Lax`
    );

    return res.status(200).json({
      ok: true,
      role: teacher.role,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
