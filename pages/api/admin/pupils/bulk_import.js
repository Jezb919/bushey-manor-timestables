// pages/api/admin/pupils/bulk_import.js

import supabaseAdminDefault, {
  supabaseAdmin as supabaseAdminNamed,
} from "../../../../lib/supabaseAdmin";

// ✅ Works no matter whether lib/supabaseAdmin exports named or default
const supabaseAdmin = supabaseAdminNamed || supabaseAdminDefault;

/**
 * Self-contained admin check (no requireAdmin dependency).
 * Looks for bmtt_teacher cookie containing JSON or base64 JSON.
 */
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function tryParseSession(raw) {
  if (!raw) return null;

  const candidates = [];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch (_) {}
  candidates.push(raw);

  for (const c of candidates) {
    // plain JSON
    try {
      const j = JSON.parse(c);
      if (j && typeof j === "object") return j;
    } catch (_) {}

    // base64 JSON
    try {
      const decoded = Buffer.from(c, "base64").toString("utf8");
      const j = JSON.parse(decoded);
      if (j && typeof j === "object") return j;
    } catch (_) {}
  }

  return null;
}

function ensureAdmin(req, res) {
  const cookies = parseCookies(req.headers?.cookie || "");
  const raw = cookies["bmtt_teacher"];
  const session = tryParseSession(raw);

  if (!session || session.role !== "admin") {
    res.status(403).json({
      ok: false,
      error: "Admin only",
      debug: {
        hasCookie: !!raw,
        parsedRole: session?.role ?? null,
        parsedKeys: session ? Object.keys(session) : [],
      },
    });
    return null;
  }
  return session;
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((line) => line.split(",").map((c) => (c ?? "").trim()));
  return { headers, rows };
}

function randomPin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function makeBaseUsername(first, last) {
  const f = (first || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = (last || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = (f.slice(0, 8) + (l ? l.slice(0, 1) : "")).slice(0, 10);
  return base || "student";
}

async function usernameExists(username) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("username", username)
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}

async function makeUniqueUsername(first, last) {
  const base = makeBaseUsername(first, last);
  for (let i = 1; i <= 999; i++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await usernameExists(`${base}${i}`);
    if (!exists) return `${base}${i}`;
  }
  return `${base}${Date.now().toString().slice(-6)}`;
}

async function findClassIdByLabel(classLabel) {
  const label = String(classLabel || "").trim();
  if (!label) return null;

  // Try classes.label
  {
    const { data, error } = await supabaseAdmin
      .from("classes")
      .select("id,label")
      .eq("label", label)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  // Try classes.class_label
  {
    const { data, error } = await supabaseAdmin
      .from("classes")
      .select("id,class_label")
      .eq("class_label", label)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  return null;
}

function safeBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_) {}
    return { csvText: req.body };
  }

  return {};
}

async function runImport(csvText) {
  const { headers, rows } = parseCsv(csvText);

  const expected = ["class_label", "first_name", "last_name"];
  const headerKey = headers.map((h) => h.toLowerCase());
  const okHeaders = expected.every((h) => headerKey.includes(h));

  if (!okHeaders) {
    return {
      ok: false,
      status: 400,
      error: `CSV must have headers exactly: ${expected.join(",")}`,
      headers,
      example: "class_label,first_name,last_name\nB4,Sam,Allen\nB4,Emma,Azim",
    };
  }

  const idx = {
    class_label: headerKey.indexOf("class_label"),
    first_name: headerKey.indexOf("first_name"),
    last_name: headerKey.indexOf("last_name"),
  };

  const created = [];
  const skipped = [];
  const classIdCache = new Map();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    const class_label = (row[idx.class_label] || "").trim();
    const first_name = (row[idx.first_name] || "").trim();
    const last_name = (row[idx.last_name] || "").trim();

    if (!class_label || !first_name || !last_name) {
      skipped.push({
        row: r + 2,
        reason: "Missing class_label / first_name / last_name",
        values: { class_label, first_name, last_name },
      });
      continue;
    }

    let class_id = classIdCache.get(class_label);
    if (!class_id) {
      // eslint-disable-next-line no-await-in-loop
      class_id = await findClassIdByLabel(class_label);
      if (!class_id) {
        skipped.push({
          row: r + 2,
          reason: `Class not found: ${class_label}`,
          values: { class_label, first_name, last_name },
        });
        continue;
      }
      classIdCache.set(class_label, class_id);
    }

    // eslint-disable-next-line no-await-in-loop
    const username = await makeUniqueUsername(first_name, last_name);
    const pin = randomPin();

    // eslint-disable-next-line no-await-in-loop
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("students")
      .insert([{ class_id, first_name, last_name, username, pin }])
      .select("id,first_name,last_name,username,class_id,pin")
      .maybeSingle();

    if (insErr) {
      skipped.push({
        row: r + 2,
        reason: "Insert failed",
        values: { class_label, first_name, last_name },
