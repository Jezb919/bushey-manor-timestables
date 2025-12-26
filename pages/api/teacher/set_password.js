import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const { token, new_password } = req.body || {};
    if (!token || !new_password) {
      return res.status(400).json({ ok: false, error: "Missing token or new_password" });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters" });
    }

    const token_hash = sha256(token);

    // Find a valid invite
    const { data: invite, error: invErr } = await supabase
      .from("teacher_invites")
      .select("id, teacher_id, expires_at, used_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (invErr) {
      return res.status(500).json({ ok: false, error: "Invite lookup failed", debug: invErr.message });
    }

    if (!invite) {
      return res.status(400).json({ ok: false, error: "Invalid link" });
    }

    if (invite.used_at) {
      return res.status(400).json({ ok: false, error: "This link has already been used" });
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: "This link has expired. Ask admin to send a new one." });
    }

    // Update teacher password_hash (matches how your login currently works)
    const { error: upErr } = await supabase
      .from("teachers")
      .update({ password_hash: String(new_password) })
      .eq("id", invite.teacher_id);

    if (upErr) {
      return res.status(500).json({ ok: false, error: "Failed to set password", debug: upErr.message });
    }

    // Mark invite used
    await supabase
      .from("teacher_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
