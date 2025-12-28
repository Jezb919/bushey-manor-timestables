// pages/api/admin/pupils/bulk_import.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function parseCSV(text) {
  // Very simple CSV parser (works for your use case).
  // Expected headers: class_label,first_name,last_name
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least 1 pupil row." };
  }

  const header = lines[0].replace(/\s+/g, "");
  const expected = "class_label,first_name,last_name";
  if (header.toLowerCase() !== expected) {
    return { ok: false, error: `CSV must have headers exactly: ${expected}` };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Split by comma (your data doesn't contain commas inside names)
    const parts = lines[i].split(",").map((p) => p.trim());
    const class_label = parts[0] || "";
    const first_name = parts[1] || "";
    const last_name = parts[2] || "";

    rows.push({ line: i + 1, class_label, first_name, last_name });
  }
  return { ok: true, rows };
}

function makeUsername(firstName, lastName, used) {
  // e.g. samallen -> samallen1, samallen2 ...
  const baseRaw = `${firstName}${lastName}`.toLowerCase();
  const base = baseRaw.replace(/[^a-z0-9]/g, "").slice(0, 12) || "pupil";
  let n = 1;
  let candidate = `${base}${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  used.add(candidate);
  return candidate;
}

function makePin() {
  // 4-digit PIN, allow leading zeros
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export default async function handler(req, res) {
  // Helpful debug if you hit it in the browser
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Use POST",
      debug: {
        gotMethod: req.method,
        hint: "Your Manage Pupils page must POST to /api/admin/pupils/bulk_import with { csvText }",
      },
    });
  }

  try {
    await requireAdmin(req, res);

    const { csvText } = req.body || {};
    const parsed = parseCSV(csvText);
    if (!parsed.ok) return res.status(400).json(parsed);

    // Preload existing usernames so we don't collide
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("students")
      .select("username");

    if (existingErr) throw existingErr;

    const used = new Set((existing || []).map((r) => r.username).filter(Boolean));

    // Cache class_label -> class_id
    const classLabelToId = new Map();

    const created = [];
    const skipped = [];

    for (const r of parsed.rows) {
      if (!r.class_label || !r.first_name || !r.last_name) {
        skipped.push({ line: r.line, reason: "Missing class_label / first_name / last_name" });
        continue;
      }

      let class_id = classLabelToId.get(r.class_label);
      if (!class_id) {
        const { data: cls, error: clsErr } = await supabaseAdmin
          .from("classes")
          .select("id,label")
          .eq("label", r.class_label)
          .maybeSingle();

        if (clsErr) throw clsErr;
        if (!cls) {
          skipped.push({ line: r.line, reason: `Unknown class label: ${r.class_label}` });
          continue;
        }
        class_id = cls.id;
        classLabelToId.set(r.class_label, class_id);
      }

      const username = makeUsername(r.first_name, r.last_name, used);
      const pin = makePin();

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("students")
        .insert({
          class_id,
          first_name: r.first_name,
          last_name: r.last_name,
          username,
          pin, // IMPORTANT: must exist as a column in students
        })
        .select("id,first_name,last_name,username,pin,class_id")
        .single();

      if (insErr) {
        skipped.push({ line: r.line, reason: insErr.message });
        continue;
      }

      created.push(inserted);
    }

    return res.status(200).json({ ok: true, created, skipped });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
