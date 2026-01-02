import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { token, password }",
      });
    }

    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }

    const supabase = getSupabaseAdmin();

    const token_hash = sha256Hex(token);

    // find invite
    const { data: invite, error: iErr } = await supabase
      .from("teacher_invites")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (iErr) return res.status(500).json({ ok: false, error: "Server error", debug: iErr.message });
    if (!invite) return res.status(400).json({ ok: false, error: "Invalid or expired token" });

    const exp = new Date(invite.expires_at).getTime();
    if (Number.isNaN(exp) || exp < Date.now()) {
      // clean up expired invite
      await supabase.from("teacher_invites").delete().eq("id", invite.id);
      return res.status(400).json({ ok: false, error: "Invalid or expired token" });
    }

    // hash password
    const password_hash = await bcrypt.hash(String(password), 10);

    // set teacher password
    const { error: uErr } = await supabase
      .from("teachers")
      .update({ password_hash })
      .eq("id", invite.teacher_id);

    if (uErr) return res.status(500).json({ ok: false, error: "Server error", debug: uErr.message });

    // delete invite (one-time use)
    await supabase.from("teacher_invites").delete().eq("id", invite.id);

    return res.status(200).json({ ok: true, info: "Password set" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
