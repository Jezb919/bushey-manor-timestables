import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- session helpers ----------
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
  if (!token) return null;

  try {
    let json = token;
    if (!json.trim().startsWith("{")) json = base64UrlDecode(token);
    const data = JSON.parse(json);

    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;

    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

// ---------- credential helpers ----------
function cleanName(s = "") {
  return String(s).trim().replace(/\s+/g, " ");
}

function baseUsername(first, last) {
  const f = cleanName(first).toLowerCase().replace(/[^a-z]/g, "");
  const l = cleanName(last).toLowerCase().replace(/[^a-z]/g, "");
  const li = l ? l[0] : "x";
  return `${f}${li}`; // e.g. sam + b => samb
}

async function generateUniqueUsername(first, last) {
  const base = baseUsername(first, last);
  // Try base1..base99
  for (let n = 1; n <= 99; n++) {
    const candidate = `${base}${n}`;
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return candidate; // free
  }
  // fallback: add random 3 digits
  const rand = Math.floor(100 + Math.random() * 900);
  return `${base}${rand}`;
}

function generateTempPassword() {
  // easy to type, no confusing chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out; // e.g. K7P2M8QZ
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  // store as "scrypt$salt$hash"
  return `scrypt$${salt}$${hash}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    // Admin-only (simple + safe)
    if (session.role !== "admin") return res.status(403).json({ ok: false, error: "Admins only" });

    const { first_name, last_name, class_id } = req.body || {};
    if (!first_name || !last_name || !class_id) {
      return res.status(400).json({ ok: false, error: "Missing first_name, last_name or class_id" });
    }

    // Get class_label
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("id", class_id)
      .maybeSingle();

    if (clsErr || !cls) return res.status(404).json({ ok: false, error: "Class not found" });

    // Generate username + temp password
    const username = await generateUniqueUsername(first_name, last_name);
    const tempPassword = generateTempPassword();
    const password_hash = hashPassword(tempPassword);

    // Insert pupil
    const { data: created, error: insErr } = await supabaseAdmin
      .from("students")
      .insert({
        first_name: cleanName(first_name),
        last_name: cleanName(last_name),
        username,
        password_hash,
        class_id: cls.id,
        class_label: cls.class_label,
      })
      .select("id, first_name, last_name, username, class_id, class_label")
      .single();

    if (insErr) {
      return res.status(500).json({ ok: false, error: "Failed to create pupil", debug: insErr.message });
    }

    // ✅ Return temp password ONCE (you copy it / print it)
    return res.json({
      ok: true,
      pupil: created,
      credentials: { username, tempPassword },
      note: "Copy the temp password now. You can reset it later, but you can't view old passwords."
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e.message || e) });
  }
}
