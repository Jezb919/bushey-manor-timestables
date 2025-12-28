import crypto from "crypto";

/**
 * Self-contained Admin API (no lib imports).
 * Requires env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY   (server-only)
 * - PUPIL_PIN_SECRET           (any random string)
 */

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
  // Accept both teacherId and teacher_id keys
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const auth = getAuthFromCookies(req);
  if (auth.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: auth });
  }

  let body = req.body;
  // Next sometimes sends string JSON
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  const class_label = normaliseName(body?.class_label || body?.classLabel);
  const first_name = normaliseName(body?.first_name || body?.firstName);
  const last_name = normaliseName(body?.last_name || body?.lastName);

  if (!class_label) return res.status(400).json({ ok: false, error: "Missing class_label" });
  if (!first_name) return res.status(400).json({ ok: false, error: "Missing first_name" });
  if (!last_name) return res.status(400).json({ ok: false, error: "Missing last_name" });

  try {
    const supabase = await supabaseAdmin();

    // 1) Find class by label
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,class_label")
      .eq("class_label", class_label)
      .single();

    if (clsErr || !cls) {
      return res.status(400).json({ ok: false, error: "Class not found", debug: clsErr?.message || clsErr });
    }

    // 2) Generate unique username
    const base = baseUsername(first_name, last_name);
    let username = "";
    for (let i = 1; i <= 999; i++) {
      const candidate = `${base}${i}`;
      const { data: existing, error: exErr } = await supabase
        .from("pupils")
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
    if (!username) {
      return res.status(500).json({ ok: false, error: "Could not generate unique username" });
    }

    // 3) Create PIN
    const pin = randomPin4();
    const pin_hash = hashPin(pin);

    // 4) Insert pupil
    // Some databases have pin_hash column, some have pin.
    // We'll try pin_hash first, then fallback to pin if that fails.
    let insertErr = null;
    let inserted = null;

    // try pin_hash
    {
      const { data, error } = await supabase
        .from("pupils")
        .insert([
          {
            class_id: cls.id,
            first_name,
            last_name,
            username,
            pin_hash, // preferred
          },
        ])
        .select("id,first_name,last_name,username,class_id")
        .single();

      if (!error) {
        inserted = data;
      } else {
        insertErr = error;
      }
    }

    // fallback to pin column if pin_hash doesn't exist
    if (!inserted) {
      const msg = insertErr?.message || "";
      const looksLikeMissingColumn =
        msg.includes("column") && (msg.includes("pin_hash") || msg.includes("does not exist"));

      if (looksLikeMissingColumn) {
        const { data, error } = await supabase
          .from("pupils")
          .insert([
            {
              class_id: cls.id,
              first_name,
              last_name,
              username,
              pin, // fallback
            },
          ])
          .select("id,first_name,last_name,username,class_id")
          .single();

        if (error) {
          return res.status(500).json({
            ok: false,
            error: "Failed to add pupil (pin column also failed)",
            debug: error.message,
          });
        }
        inserted = data;
      } else {
        return res.status(500).json({
          ok: false,
          error: "Failed to add pupil",
          debug: insertErr?.message || insertErr,
        });
      }
    }

    return res.json({
      ok: true,
      pupil: {
        id: inserted.id,
        first_name: inserted.first_name,
        last_name: inserted.last_name,
        username: inserted.username,
        class_id: inserted.class_id,
        class_label: cls.class_label,
      },
      // IMPORTANT: only show PIN once at creation time
      pin,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
