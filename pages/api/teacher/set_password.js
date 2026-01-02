import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return null;
}

async function findTokenRow(supabase, token) {
  // Your repo might be using one of these tables. We try both.
  const candidateTables = ["teacher_password_tokens", "teacher_setup_tokens"];

  for (const table of candidateTables) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!error && data) {
      return { table, row: data };
    }

    // If table doesn't exist, Supabase commonly returns a message about relation not existing.
    // We'll just try the next one.
  }

  return { table: null, row: null };
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

    if (!token || typeof token !== "string" || token.length < 20) {
      return res.status(400).json({ ok: false, error: "Missing/invalid token" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "Password too short (min 6 characters)",
      });
    }

    const supabase = getSupabaseAdmin();

    // 1) Find token row
    const { table, row } = await findTokenRow(supabase, token);
    if (!row) {
      return res.status(400).json({
        ok: false,
        error: "Invalid or expired token",
        debug: "Token not found in expected token tables",
      });
    }

    const teacherId = pick(row, ["teacher_id", "teacherId", "teacher"]);
    const expiresAt = pick(row, ["expires_at", "expiresAt"]);
    const usedAt = pick(row, ["used_at", "usedAt"]);

    if (!teacherId) {
      return res.status(400).json({
        ok: false,
        error: "Token record missing teacher_id",
        debug: { tokenTable: table, tokenKeys: Object.keys(row) },
      });
    }

    if (usedAt) {
      return res.status(400).json({ ok: false, error: "Token already used" });
    }

    if (expiresAt) {
      const exp = new Date(expiresAt);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return res.status(400).json({ ok: false, error: "Token expired" });
      }
    }

    // 2) Update teacher password_hash
    const passwordHash = await bcrypt.hash(password, 10);

    const { error: updErr } = await supabase
      .from("teachers")
      .update({ password_hash: passwordHash })
      .eq("id", teacherId);

    if (updErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to update password",
        debug: updErr.message,
      });
    }

    // 3) Mark token used (if table supports it)
    // If the token table doesn't have used_at, this will error; we ignore that.
    await supabase
      .from(table)
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    return res.status(200).json({ ok: true, message: "Password set" });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
