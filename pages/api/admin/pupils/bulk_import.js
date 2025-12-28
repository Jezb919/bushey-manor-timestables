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
  try { return JSON.parse(str); } catch { return null; }
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

async function detectStudentTable(supabase) {
  for (const t of ["students", "pupils"]) {
    const { error } = await supabase.from(t).select("id").limit(1);
    if (!error) return t;
  }
  return "students";
}

function parseCsvText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });

  return { headers, rows };
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function baseUsername(first, last) {
  const f = slug(first);
  const l = slug(last);
  return `${f}${l ? l[0] : "x"}` || "pupil";
}

function randomPin4() {
  return String(crypto.randomInt(1000, 10000));
}

function hashPin(pin) {
  const secret = process.env.PUPIL_PIN_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${pin}:${secret}`).digest("hex");
}

export default async function handler(req, res) {
  // Allow a simple GET debug check in the browser
  if (req.method === "GET") {
    return res.json({ ok: true, note: "bulk_import endpoint is live. Use POST to import." });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const auth = getAuthFromCookies(req);
  if (auth.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: auth });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  const csv_text = body?.csv_text || body?.csvText || "";
  const { headers, rows } = parseCsvText(csv_text);

  const required = ["class_label", "first_name", "last_name"];
  for (const h of required) {
    if (!headers.includes(h)) {
      return res.status(400).json({
        ok: false,
        error: `CSV must have headers: ${required.join(", ")}`,
        got: headers,
      });
    }
  }

  try {
    const supabase = await supabaseAdmin();
    const table = await detectStudentTable(supabase);

    // classes map
    const { data: classes, error: clsErr } = await supabase
      .from("classes")
      .select("id,class_label");

    if (clsErr) {
      return res.status(500).json({ ok: false, error: "Failed to load classes", debug: clsErr.message });
    }

    const classMap = new Map((classes || []).map((c) => [c.class_label, c.id]));

    // existing usernames for uniqueness
    const { data: existing, error: exErr } = await supabase
      .from(table)
      .select("username");

    if (exErr) {
      return res.status(500).json({ ok: false, error: "Failed to read existing pupils", debug: exErr.message, table });
    }

    const used = new Set((existing || []).map((x) => x.username).filter(Boolean));

    const created = [];
    const skipped = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const class_label = String(r.class_label || "").trim();
      const first_name = String(r.first_name || "").trim();
      const last_name = String(r.last_name || "").trim();

      if (!class_label || !first_name || !last_name) {
        skipped.push({ row: i + 2, reason: "Missing class_label / first_name / last_name", data: r });
        continue;
      }

      const class_id = classMap.get(class_label);
      if (!class_id) {
        skipped.push({ row: i + 2, reason: `Unknown class_label: ${class_label}`, data: r });
        continue;
      }

      const base = baseUsername(first_name, last_name);
      let username = "";
      for (let n = 1; n < 5000; n++) {
        const candidate = `${base}${n}`;
        if (!used.has(candidate)) {
          username = candidate;
          used.add(candidate);
          break;
        }
      }
      if (!username) {
        skipped.push({ row: i + 2, reason: "Could not generate unique username", data: r });
        continue;
      }

      const pin = randomPin4();
      const pin_hash = hashPin(pin);

      // Try insert with pin_hash first, then fallback to pin
      let inserted = null;

      {
        const { data, error } = await supabase
          .from(table)
          .insert([{
            class_id,
            class_label,     // keep if your table has it; harmless if it doesn't? (can error)
            first_name,
            last_name,
            username,
            pin_hash,
          }])
          .select("id,first_name,last_name,username")
          .single();

        if (!error) inserted = data;
        else {
          const msg = error.message || "";
          const missingColumn = msg.includes("column") && (msg.includes("pin_hash") || msg.includes("class_label"));
          if (!missingColumn) {
            skipped.push({ row: i + 2, reason: msg, data: r });
          }
        }
      }

      if (!inserted) {
        const { data, error } = await supabase
          .from(table)
          .insert([{
            class_id,
            class_label, // may error if column doesn't exist; we handle below
            first_name,
            last_name,
            username,
            pin,
          }])
          .select("id,first_name,last_name,username")
          .single();

        if (error) {
          // try again without class_label (some schemas don’t have it)
          const { data: data2, error: error2 } = await supabase
            .from(table)
            .insert([{
              class_id,
              first_name,
              last_name,
              username,
              pin,
            }])
            .select("id,first_name,last_name,username")
            .single();

          if (error2) {
            skipped.push({ row: i + 2, reason: error2.message, data: r });
            continue;
          }
          inserted = data2;
        } else {
          inserted = data;
        }
      }

      created.push({
        id: inserted.id,
        class_label,
        first_name,
        last_name,
        username,
        pin,
      });
    }

    return res.json({
      ok: true,
      table_used: table,
      created_count: created.length,
      skipped_count: skipped.length,
      created,
      skipped,
      note: "PINs are shown here once. Download/copy them now.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
