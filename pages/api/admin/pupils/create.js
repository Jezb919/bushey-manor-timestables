import crypto from "crypto";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin"; // if you already have this helper

function randPin() {
  // 1000–9999
  return String(crypto.randomInt(1000, 10000));
}

function slug(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

async function generateUniqueUsername(base) {
  // base like "zacj"
  for (let i = 1; i < 9999; i++) {
    const candidate = `${base}${i}`;
    const { data } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // fallback
  return `${base}${crypto.randomInt(10000, 99999)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  // If you DON'T have requireAdmin helper, comment this out and use your existing admin check.
  const adminCheck = await requireAdmin(req, res);
  if (!adminCheck?.ok) return; // requireAdmin already responds

  try {
    const { class_label, first_name, last_name } = req.body || {};
    if (!class_label || !first_name || !last_name) {
      return res.status(400).json({ ok: false, error: "Missing class / first name / surname" });
    }

    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label, year_group")
      .eq("class_label", class_label)
      .maybeSingle();

    if (clsErr) return res.status(500).json({ ok: false, error: "Failed to load class", debug: clsErr.message });
    if (!cls) return res.status(400).json({ ok: false, error: "Class not found" });

    const base = `${slug(first_name)}${slug(last_name).slice(0, 1)}` || "pupil";
    const username = await generateUniqueUsername(base);
    const pin = randPin();

    const insertRow = {
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      username,
      pin,
      class_id: cls.id,
      class_label: cls.class_label,
      year: cls.year_group ?? null,
    };

    const { data: created, error: insErr } = await supabaseAdmin
      .from("students")
      .insert(insertRow)
      .select("id, first_name, last_name, username, pin, class_label")
      .single();

    if (insErr) {
      return res.status(500).json({ ok: false, error: "Failed to create pupil", debug: insErr.message });
    }

    return res.json({ ok: true, pupil: created });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
