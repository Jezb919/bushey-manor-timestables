import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function requireAdminFromCookie(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies.bmtt_teacher;
  if (!raw) return { ok: false, error: "Not signed in" };

  try {
    const session = JSON.parse(raw);
    if (session?.role !== "admin") return { ok: false, error: "Admin only" };
    return { ok: true, session };
  } catch {
    return { ok: false, error: "Bad session cookie" };
  }
}

function baseUrlFromReq(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        info: "POST only. Send JSON: { teacher_id }",
      });
    }

    const gate = requireAdminFromCookie(req);
    if (!gate.ok) return res.status(401).json({ ok: false, error: gate.error });

    const { teacher_id } = req.body || {};
    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    const supabase = getSupabaseAdmin();

    // generate token + expiry
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    const { data: updated, error: upErr } = await supabase
      .from("teachers")
      .update({ setup_token: token, setup_token_expires: expires })
      .eq("id", teacher_id)
      .select("id,email,full_name,setup_token,setup_token_expires")
      .single();

    if (upErr) {
      return res.status(500).json({ ok: false, error: "Server error", debug: upErr.message });
    }

    const base = baseUrlFromReq(req);
    const setup_url = `${base}/teacher/set-password?token=${token}`;

    // NOTE: we are NOT emailing (no email service configured).
    // We return the link so admin can copy/paste.
    return res.status(200).json({
      ok: true,
      info: "Setup link created (copy/paste to the teacher).",
      setup_url,
      teacher: {
        id: updated.id,
        email: updated.email,
        full_name: updated.full_name,
        setup_token_expires: updated.setup_token_expires,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
