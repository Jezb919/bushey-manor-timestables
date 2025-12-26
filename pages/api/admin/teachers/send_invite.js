import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      teacher_id: p.teacherId || p.teacher_id || null,
      role: p.role || null,
      email: p.email || null,
    };
  } catch {
    return null;
  }
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex"); // long, unguessable
}

async function sendEmailViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // If email isn't configured, return a clear error.
    return { ok: false, error: "Email not configured (missing RESEND_API_KEY or EMAIL_FROM)" };
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* ignore */ }

  if (!r.ok) {
    return { ok: false, error: "Resend error", debug: data || text };
  }
  return { ok: true, data };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const teacher_id = req.body?.teacher_id;
    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    // Get teacher email/name
    const { data: teacher, error: tErr } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("id", teacher_id)
      .single();

    if (tErr || !teacher) {
      return res.status(404).json({ ok: false, error: "Teacher not found", debug: tErr?.message });
    }

    // Create invite token (store hash, email raw token)
    const token = randomToken();
    const token_hash = sha256(token);

    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    const { error: iErr } = await supabase
      .from("teacher_invites")
      .insert([{ teacher_id, token_hash, expires_at }]);

    if (iErr) {
      return res.status(500).json({ ok: false, error: "Failed to create invite", debug: iErr.message });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${req.headers.host}`;

    const link = `${baseUrl}/teacher/set-password?token=${token}`;

    const subject = "Set up your Bushey Manor Times Tables teacher account";
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>Set up your teacher account</h2>
        <p>Hello ${teacher.full_name || ""},</p>
        <p>Please click the link below to set your password. This link expires in <b>24 hours</b>.</p>
        <p><a href="${link}">${link}</a></p>
        <p>If the link expires, your admin can send a new one.</p>
      </div>
    `;

    const emailResult = await sendEmailViaResend({
      to: teacher.email,
      subject,
      html,
    });

    if (!emailResult.ok) {
      // Still return the link so you can copy/paste manually if email not configured
      return res.status(200).json({
        ok: false,
        error: emailResult.error,
        debug: emailResult.debug || null,
        fallback_link: link,
      });
    }

    return res.json({ ok: true, sent_to: teacher.email });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
