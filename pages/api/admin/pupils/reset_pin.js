import cookie from "cookie";

function readTeacherCookie(req) {
  const cookies = cookie.parse(req.headers.cookie || "");
  const raw = cookies.bmtt_teacher || cookies.bmtt_session;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function genPin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function tryUpdatePin(supabase, student_id, newPin, columnName) {
  const payload = { [columnName]: newPin };

  const { error } = await supabase.from("students").update(payload).eq("id", student_id);

  if (!error) return { ok: true, column: columnName };

  // If column doesn't exist, try next
  const msg = String(error.message || "");
  if (msg.includes("does not exist") && msg.includes(columnName)) {
    return { ok: false, reason: "missing_column", message: msg };
  }

  // Any other error = real failure
  return { ok: false, reason: "other", message: msg };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const session = readTeacherCookie(req);
  if (!session || session.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: session || null });
  }

  const { student_id } = req.body || {};
  if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

  try {
    const supabase = supabaseAdmin();

    // Check pupil exists
    const { data: pupil, error: pupilErr } = await supabase
      .from("students")
      .select("id")
      .eq("id", student_id)
      .maybeSingle();

    if (pupilErr) throw new Error(pupilErr.message);
    if (!pupil) return res.status(404).json({ ok: false, error: "Pupil not found" });

    const newPin = genPin();

    // Try common schema variants (your project has shifted a few times)
    const candidates = ["pin", "pin_hash", "passcode", "password"];
    const attempts = [];

    for (const col of candidates) {
      const result = await tryUpdatePin(supabase, student_id, newPin, col);
      attempts.push({ col, ...result });

      if (result.ok) {
        return res.json({ ok: true, pin: newPin, stored_in: col });
      }

      if (result.reason === "other") {
        return res.status(500).json({
          ok: false,
          error: "Failed to reset PIN",
          debug: { col, message: result.message, attempts },
        });
      }
    }

    // If we got here: none of the columns exist
    return res.status(500).json({
      ok: false,
      error: "No usable PIN column found on students table",
      debug: { tried: candidates, attempts },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Failed to reset PIN",
      debug: String(e.message || e),
    });
  }
}
