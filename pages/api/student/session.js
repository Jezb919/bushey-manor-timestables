// pages/api/student/session.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);

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

  // We’re going to store:
  //   first_name = child’s name (what they type)
  //   last_name  = class name (3M, 4B, etc.)
  const firstName = String(name).trim();
  const classText = String(className).trim();

  try {
    // 🔍 1) Look for an existing pupil with same first_name + last_name
    const { data: existing, error: selectError } = await supabase
      .from("students")
      .select("id")
      .eq("first_name", firstName)
      .eq("last_name", classText)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase students SELECT error:", selectError);
      return res.status(500).json({
        ok: false,
        error: selectError.message || "Select from students failed",
      });
    }

    if (existing) {
      // Found them – return the id
      return res.status(200).json({ ok: true, studentId: existing.id });
    }

    // ➕ 2) Not found – create a new record
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        first_name: firstName,
        last_name: classText,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Supabase students INSERT error:", insertError);
      return res.status(500).json({
        ok: false,
        error: insertError.message || "Insert into students failed",
      });
    }

    return res.status(200).json({ ok: true, studentId: inserted.id });
  } catch (err) {
    console.error("Unexpected error in /api/student/session:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Unexpected server error" });
  }
}
