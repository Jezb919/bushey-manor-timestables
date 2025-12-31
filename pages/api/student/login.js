// pages/api/student/login.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// --- tiny cookie helpers (no npm 'cookie' dependency) ---
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const {
    httpOnly = true,
    sameSite = "Lax",
    secure = process.env.NODE_ENV === "production",
    path = "/",
    maxAge = 60 * 60 * 24 * 30, // 30 days
  } = opts;

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");

  // allow multiple set-cookie headers
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", parts.join("; "));
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, parts.join("; ")]);
  else res.setHeader("Set-Cookie", [prev, parts.join("; ")]);
}

function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0 });
}

// store session as a simple JSON string
function makeStudentSession(payload) {
  return JSON.stringify(payload);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info: "Send JSON: { username, pin }",
      });
    }

    const { username, pin } = req.body || {};
    const u = (username || "").trim().toLowerCase();
    const p = (pin || "").toString().trim();

    if (!u || !p) {
      return res.status(400).json({ ok: false, error: "Missing username or PIN" });
    }
    if (!/^\d{4}$/.test(p)) {
      return res.status(400).json({ ok: false, error: "PIN must be 4 digits" });
    }

    // IMPORTANT: your table is called 'students'
    // Columns you listed include: id, username, pin, class_id, active, first_name/surname/last_name etc.
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, username, pin, class_id, active, first_name, surname, last_name")
      .eq("username", u)
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Database error", debug: error.message });
    }

    if (!student) {
      return res.status(401).json({ ok: false, error: "Invalid username or PIN" });
    }

    if (student.active === false) {
      return res.status(403).json({ ok: false, error: "Account disabled" });
    }

    // simplest: check plain 4-digit pin column
    if ((student.pin || "").toString() !== p) {
      return res.status(401).json({ ok: false, error: "Invalid username or PIN" });
    }

    // fetch class_label (your session showed class_label null earlier — this fixes it)
    let class_label = null;
    if (student.class_id) {
      const { data: cls } = await supabaseAdmin
        .from("classes")
        .select("class_label")
        .eq("id", student.class_id)
        .maybeSingle();
      class_label = cls?.class_label ?? null;
    }

    // clear any old student cookie first (avoid weirdness)
    clearCookie(res, "bmtt_student");

    // create cookie session
    const session = makeStudentSession({
      studentId: student.id,
      class_id: student.class_id || null,
      class_label,
      username: student.username,
    });

    setCookie(res, "bmtt_student", session);

    return res.status(200).json({
      ok: true,
      student: {
        id: student.id,
        username: student.username,
        class_id: student.class_id || null,
        class_label,
        name: [student.first_name, student.last_name || student.surname].filter(Boolean).join(" "),
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
