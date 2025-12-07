// pages/api/student/session.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use the service role key so we can read/write all students safely on the server
const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: "Method not allowed (POST only)" });
  }

  const { name, className } = req.body || {};

  if (!name || !className) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing name or className" });
  }

  const firstName = name.trim();
  const classText = className.trim(); // we’ll store the class in last_name

  try {
    // 🔍 1) Look up existing student by FIRST + LAST name
    const { data: existing, error: selectError } = await supabase
      .from("students")
      .select("id")
      .eq("first_name", firstName)
      .eq("last_name", classText)
      .maybeSingle();

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res.status(500).json({
        ok: false,
        error: selectError.message || "Select from students failed",
      });
    }

    // Found existing pupil
    if (existing) {
      return res.status(200).json({ ok: true, studentId: existing.id });
    }

    // ➕ 2) No row yet – create one
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        first_name: firstName,
        last_name: classText, // using last_name as "class" for now
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
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
