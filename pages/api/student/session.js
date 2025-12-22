// pages/api/student/session.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "Supabase env vars missing – check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Normalise class input so:
 * - " 4m " -> "M4"
 * - "4 M"  -> "M4"
 * - "m4"   -> "M4"
 * - "B3"   -> "B3"
 */
function normaliseClassLabel(value) {
  let v = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  // Convert 4M / 3B / 10M -> M4 / B3 / M10
  if (/^[0-9]{1,2}[A-Z]$/.test(v)) {
    const year = v.slice(0, -1);      // "4"
    const letter = v.slice(-1);       // "M"
    v = `${letter}${year}`;           // "M4"
  }

  return v;
}

/**
 * Normalise name so we don't store weird spaces
 */
function normaliseName(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: "Method not allowed – use POST" });
  }

  const { name, className } = req.body || {};

  if (!name || !className) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing name or className" });
  }

  const firstName = normaliseName(name);
  const classLabel = normaliseClassLabel(className);

  if (!firstName || !classLabel) {
    return res
      .status(400)
      .json({ ok: false, error: "Name/class cannot be blank" });
  }

  try {
    // 1) Look for an existing student with same first_name + class_label
    const { data: existing, error: selectError } = await supabase
      .from("students")
      .select("id, first_name, class_label")
      .eq("first_name", firstName)
      .eq("class_label", classLabel)
      .maybeSingle(); // 0 or 1 row

    if (selectError) {
      console.error("Supabase SELECT students error:", selectError);
      return res.status(500).json({
        ok: false,
        error: selectError.message || "Failed to read students table",
      });
    }

    if (existing) {
      return res.status(200).json({
        ok: true,
        studentId: existing.id,
        class_label: classLabel,
      });
    }

    // 2) Not found – create them
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        first_name: firstName,
        class_label: classLabel,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Supabase INSERT students error:", insertError);
      return res.status(500).json({
        ok: false,
        error: insertError.message || "Failed to insert into students table",
      });
    }

    return res.status(200).json({
      ok: true,
      studentId: inserted.id,
      class_label: classLabel,
    });
  } catch (err) {
    console.error("Unexpected /api/student/session error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Unexpected server error" });
  }
}
