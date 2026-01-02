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
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        info: "POST only. Send JSON: { token, new_password }",
      });
    }

    const { token, new_password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });
    if (!new_password || String(new_password).length < 6) {
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }

    const supabase = getSupabaseAdmin();

    // Find teacher by token
    const { data: teacher, error: findErr } = await supabase
      .from("teachers")
      .select("id,setup_token,setup_token_expires")
      .eq("setup_token", token)
      .maybeSingle();

    if (findErr) return res.status(500).json({ ok: false, error: "Server error", debug: findErr.message });
    if (!teacher) return res.status(400).json({ ok: false, error: "Invalid or expired setup link" });

    const exp = teacher.setup_token_expires ? new Date(teacher.setup_token_expires).getTime() : 0;
    if (!exp || Date.now() > exp) {
      return res.status(400).json({ ok: false, error: "Setup link expired. Ask admin to send a new one." });
    }

    const password_hash = await bcrypt.hash(String(new_password), 10);

    const { error: upErr } = await supabase
      .from("teachers")
      .update({
        password_hash,
        setup_token: null,
        setup_token_expires: null,
      })
      .eq("id", teacher.id);

    if (upErr) return res.status(500).json({ ok: false, error: "Server error", debug: upErr.message });

    return res.status(200).json({ ok: true, info: "Password set. You can now log in." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
