import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => (c ?? "").trim()));
  return { headers, rows };
}

function makeBaseUsername(first, last) {
  const f = (first || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = (last || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = (f.slice(0, 8) + (l ? l.slice(0, 1) : "")).slice(0, 10);
  return base || "student";
}

function randomPin() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

async function findClassIdByLabel(classLabel) {
  const label = String(classLabel || "").trim();
  if (!label) return null;

  // Try classes.label
  {
    const { data } = await supabaseAdmin
      .from("classes")
      .select("id,label")
      .eq("label", label)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Try classes.class_label
  {
    const { data } = await supabaseAdmin
      .from("classes")
      .select("id,class_label")
      .eq("class_label", label)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

async function usernameExists(username) {
  const { data } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("username", username)
    .limit(1);
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

export default async function handler(req, res) {
  try {
    // Helpful GET response (so visiting in browser isn't confusing)
    if (req.method === "GET") {
      await requireAdmin(req, res);
      return res.status(200).json({
        ok: true,
        info: "This endpoint expects POST from the Manage Pupils page (Bulk import). If import fails, refresh the page and try again — errors will now show the real reason.",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    await requireAdmin(req, res);

    const { csvText } = req.body || {};
    const { headers, rows } = parseCsv(csvText);

    const expected = ["class_label", "first_name", "last_name"];
    const headerKey = headers.map((h) => h.toLowerCase());

    const okHeaders = expected.every((h) => headerKey.includes(h));
    if (!okHeaders) {
      return res.status(400).json({
        ok: false,
        error: `CSV must have headers exactly: ${expected.join(",")}`,
        headers,
      });
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

      // IMPORTANT: This assumes column name is students.pin
      // If your DB uses pin_code / passcode, the error will now show clearly.
      // eslint-disable-next-line no-await-in-loop
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("students")
        .insert([
          {
            class_id,
            first_name,
            last_name,
            username,
            pin,
          },
        ])
        .select("id,first_name,last_name,username,class_id,pin")
        .maybeSingle();

      if (insErr) {
        skipped.push({
          row: r + 2,
          reason: "Insert failed",
          values: { class_label, first_name, last_name },
          error: insErr.message,
        });
        continue;
      }

      created.push({
        id: inserted.id,
        first_name: inserted.first_name,
        last_name: inserted.last_name,
        username: inserted.username,
        pin: inserted.pin ?? pin,
        class_label,
      });
    }

    return res.status(200).json({
      ok: true,
      created,
      skipped,
      summary: {
        totalRows: rows.length,
        created: created.length,
        skipped: skipped.length,
      },
    });
  } catch (e) {
    // ✅ Critical change: ALWAYS return the real crash reason (admin-only route)
    const msg = e?.message || String(e);
    return res.status(500).json({
      ok: false,
      error: "Server error (bulk import crashed)",
      debug: msg,
    });
  }
}
