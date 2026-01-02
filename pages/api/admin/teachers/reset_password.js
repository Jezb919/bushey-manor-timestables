import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

function makeTempPassword() {
  // 8 chars hex, easy to type
  return crypto.randomBytes(4).toString("hex");
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

    const temp_password = makeTempPassword();
    const password_hash = await bcrypt.hash(temp_password, 10);

    const { data: updated, error: upErr } = await supabase
      .from("teachers")
      .update({ password_hash })
      .eq("id", teacher_id)
      .select("id,email,full_name")
      .single();

    if (upErr) {
      return res.status(500).json({ ok: false, error: "Server error", debug: upErr.message });
    }

    // We show the temp password ON SCREEN to admin (because no email configured).
    return res.status(200).json({
      ok: true,
      info: "Password reset. Give this temporary password to the teacher.",
      temp_password,
      teacher: updated,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
