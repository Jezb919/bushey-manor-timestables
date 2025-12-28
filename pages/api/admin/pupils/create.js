import crypto from "crypto";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function getAuthFromCookies(req) {
  const cookies = parseCookies(req);
  const raw = cookies.bmtt_teacher || cookies.bmtt_session || "";
  const parsed = safeJsonParse(raw);
  const role = parsed?.role || null;
  const teacherId = parsed?.teacherId || parsed?.teacher_id || null;
  return { role, teacherId };
}

async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

function normaliseName(s) {
  return String(s || "").trim();
}

function baseUsername(first, last) {
  const f = normaliseName(first).toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = normaliseName(last).toLowerCase().replace(/[^a-z0-9]/g, "");
  const initial = l ? l[0] : "x";
  return `${f}${initial}`;
}

function randomPin4() {
  const n = Math.floor(Math.random() * 10000);
  return String(n).padStart(4, "0");
}

function hashPin(pin) {
  const secret = process.env.PUPIL_PIN_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${pin}:${secret}`).digest("hex");
}

// Try to use the real table name in YOUR database.
// Many versions use "students" not "pupils".
async function detectStudentTable(supabase) {
  // Prefer students first
  const tryTables = ["students", "pupils"];
  for (const t of tryTables) {
    const { error } = await supabase.from(t).select("id").limit(1);
    if (!error) return t;
  }
  // If both error, return first so we show a helpful error later
  return "students";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const auth = getAuthFromCookies(req);
  if (auth.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: auth });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {}
  }

  const class_label = normaliseName(body?.class_label || body?.classLabel);
  const first_name = normaliseName(body?.first_name || body?.firstName);
  const last_name = normaliseName(body?.last_name || body?.lastName);

  if (!class_label) return res.status(400).json({ ok: false, error: "Missing class_label" });
  if (!first_name) return res.status(400).json({ ok: false, error: "Missing first_name" });
  if (!last_name) return res.status(400).json({ ok: false, error: "Missing last_name" });

  try {
    const supabase = await supabaseAdmin();
    const table = await detectStudentTable(supabase);

    // Find class by label
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,class_label")
      .eq("class_label", class_label)
      .single();

    if (clsErr || !cls) {
      return res.status(400).json({ ok: false, error: "Class not found", debug: clsErr?.message || clsErr });
    }

    // Generate unique username
    const base = baseUsername(first_name, last_name);
    let username = "";
    for (let i = 1; i <= 999; i++) {
      const candidate = `${base}${i}`;
      const { data: existing, error: exErr } = await supabase
        .from(table)
        .select("id")
        .eq("username", candidate)
        .limit(1);

      if (exErr) {
        return res.status(500).json({ ok: false, error: "Failed checking username", debug: exErr.message });
      }
      if (!existing || existing.length === 0) {
        username = candidate;
        break;
      }
    }
    if (!username) return res.status(500).json({ ok: false, error: "Could not generate unique username" });

    // Create PIN
    const pin = randomPin4();
    const pin_hash = hashPin(pin);

    // Insert pupil/student
    // Some DBs use pin_hash, others use pin, others use passcode etc.
    // We'll try pin_hash, then pin.
    let inserted = null;

    // Attempt 1: pin_hash
    {
      const { data, error } = await supabase
        .from(table)
        .insert([
          {
            class_id: cls.id,
            first_name,
            last_name,
            username,
            pin_hash,
          },
        ])
        .select("id,first_name,last_name,username,class_id")
        .single();

      if (!error) inserted = data;
      else {
        // If pin_hash column doesn't exist, try pin
        const msg = error.message || "";
        const missingPinHash =
          msg.includes("column") && (msg.includes("pin_hash") || msg.includes("does not exist"));

        if (!missingPinHash) {
          return res.status(500).json({ ok: false, error: "Failed to add pupil", debug: msg, table });
        }
      }
    }

    // Attempt 2: pin
    if (!inserted) {
      const { data, error } = await supabase
        .from(table)
        .insert([
          {
            class_id: cls.id,
            first_name,
            last_name,
            username,
            pin,
          },
        ])
        .select("id,first_name,last_name,username,class_id")
        .single();

      if (error) {
        return res.status(500).json({ ok: false, error: "Failed to add pupil", debug: error.message, table });
      }
      inserted = data;
    }

    return res.json({
      ok: true,
      table_used: table,
      pupil: {
        id: inserted.id,
        first_name: inserted.first_name,
        last_name: inserted.last_name,
        username: inserted.username,
        class_id: inserted.class_id,
        class_label: cls.class_label,
      },
      pin, // show once
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
