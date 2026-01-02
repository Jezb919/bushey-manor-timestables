import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// tiny cookie parser (no external deps)
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

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { teacher_id }",
      });
    }

    // (basic check) must be logged in as admin via bmtt_teacher cookie
    const cookies = parseCookies(req.headers.cookie || "");
    let adminSession = null;
    try {
      adminSession = cookies.bmtt_teacher ? JSON.parse(cookies.bmtt_teacher) : null;
    } catch {}
    if (!adminSession || adminSession.role !== "admin") {
      return res.status(401).json({ ok: false, error: "Admin only" });
    }

    const { teacher_id } = req.body || {};
    if (!teacher_id) {
      return res.status(400).json({ ok: false, error: "Missing teacher_id" });
    }

    const supabase = getSupabaseAdmin();

    // ensure teacher exists
    const { data: teacher, error: tErr } = await supabase
      .from("teachers")
      .select("id,email,full_name,role")
      .eq("id", teacher_id)
      .maybeSingle();

    if (tErr) return res.status(500).json({ ok: false, error: "Server error", debug: tErr.message });
    if (!teacher) return res.status(404).json({ ok: false, error: "Teacher not found" });

    // create token + hash
    const token = crypto.randomBytes(24).toString("hex"); // raw token (goes in URL)
    const token_hash = sha256Hex(token);
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    // store invite (one per teacher if you added unique index)
    const { error: upErr } = await supabase
      .from("teacher_invites")
      .upsert(
        { teacher_id: teacher.id, token_hash, expires_at: expires_at.toISOString() },
        { onConflict: "teacher_id" }
      );

    if (upErr) {
      return res.status(500).json({ ok: false, error: "Server error", debug: upErr.message });
    }

    // build link
    const origin =
      (req.headers["x-forwarded-proto"] ? req.headers["x-forwarded-proto"] + "://" : "https://") +
      (req.headers["x-forwarded-host"] || req.headers.host);

    const setupLink = `${origin}/teacher/set-password?token=${token}`;

    return res.status(200).json({
      ok: true,
      info: "Setup link created (copy/paste to the teacher).",
      setupLink,
      teacher: { id: teacher.id, email: teacher.email, full_name: teacher.full_name, role: teacher.role },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
