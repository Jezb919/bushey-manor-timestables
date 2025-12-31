import { createClient } from "@supabase/supabase-js";

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

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.secure !== false) parts.push("Secure");
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Helpful debug info
      return res.status(200).json({
        ok: true,
        info: "POST only. Send JSON: { username, pin }",
        cookieNames: Object.keys(parseCookies(req.headers.cookie || "")),
      });
    }

    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ ok: false, error: "Method not allowed (POST only)" });
    }

    const { username, pin } = req.body || {};
    const u = (username || "").trim().toLowerCase();
    const p = (pin || "").toString().trim();

    if (!u || !p) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing username or PIN" });
    }

    const supabase = getSupabaseAdmin();

    // students table (your real schema)
    const { data: student, error } = await supabase
      .from("students")
      .select(
        "id, username, pin, active, class_id, class_label, first_name, last_name, surname"
      )
      .eq("username", u)
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Server error", debug: error.message });
    }
    if (!student) {
      return res.status(401).json({ ok: false, error: "Invalid username or PIN" });
    }
    if (student.active === false) {
      return res.status(403).json({ ok: false, error: "Account disabled" });
    }

    // PIN check (no bcrypt needed)
    const dbPin = (student.pin || "").toString().trim();
    if (dbPin !== p) {
      return res.status(401).json({ ok: false, error: "Invalid username or PIN" });
    }

    // Store minimal session in cookie
    const sessionObj = {
      studentId: student.id,
      class_id: student.class_id || null,
      username: student.username,
    };

    setCookie(res, "bmtt_student", JSON.stringify(sessionObj), {
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res.status(200).json({
      ok: true,
      info: "Signed in",
      student: {
        id: student.id,
        username: student.username,
        class_id: student.class_id || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
