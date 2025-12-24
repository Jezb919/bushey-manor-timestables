import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(cookieHeader = "") {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function base64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return { session: null, cookieNames: Object.keys(cookies) };

  try {
    let json = token;
    if (!json.trim().startsWith("{")) json = base64UrlDecode(token);
    const data = JSON.parse(json);

    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return { session: null, cookieNames: Object.keys(cookies), parsedKeys: Object.keys(data) };

    return {
      session: { teacher_id, role: data.role || "teacher" },
      cookieNames: Object.keys(cookies),
      parsedKeys: Object.keys(data),
    };
  } catch {
    return { session: null, cookieNames: Object.keys(cookies), note: "Cookie present but not parseable" };
  }
}

function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const sessInfo = await getTeacherFromSession(req);
    const session = sessInfo.session;

    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
        debug: { cookieNames: sessInfo.cookieNames, note: sessInfo.note || null, parsedKeys: sessInfo.parsedKeys || null },
      });
    }

    if (session.role !== "admin") {
      return res.status(403).json({
        ok: false,
        error: "Admins only",
        debug: { role: session.role, teacher_id: session.teacher_id, cookieNames: sessInfo.cookieNames, parsedKeys: sessInfo.parsedKeys },
      });
    }

    const { student_id } = req.body || {};
    if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

    const tempPassword = generateTempPassword();
    const password_hash = hashPassword(tempPassword);

    const { data: updated, error } = await supabaseAdmin
      .from("students")
      .update({ password_hash })
      .eq("id", student_id)
      .select("id, first_name, last_name, username, class_label")
      .single();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to reset password",
        debug: error.message,
      });
    }

    return res.json({
      ok: true,
      pupil: updated,
      credentials: { username: updated.username, tempPassword },
      note: "Copy this temp password now. Old passwords cannot be viewed.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
