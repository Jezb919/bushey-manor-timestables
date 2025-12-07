// pages/api/student/session.js
import { supabase } from "../../../lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, className } = req.body;

    if (!name || !className) {
      return res.status(400).json({ error: "Missing name or class" });
    }

    // 1. Try to FIND an existing student using first_name + last_name
    const { data: existingStudent, error: findError } = await supabase
      .from("students")
      .select("*")
      .eq("first_name", name)     // <--- uses first_name column
      .eq("last_name", className) // <--- uses last_name column (your class)
      .maybeSingle();

    if (findError) {
      console.error("Error finding student:", findError);
      return res.status(500).json({ error: "Error finding student" });
    }

    let student = existingStudent;

    // 2. If not found, CREATE a new row in students
    if (!student) {
      const { data: newStudent, error: insertError } = await supabase
        .from("students")
        .insert({
          first_name: name,       // <--- write name into first_name
          last_name: className,   // <--- write class into last_name
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating student:", insertError);
        return res.status(500).json({ error: "Error creating student" });
      }

      student = newStudent;
    }

    // 3. Return the student to the frontend
    return res.status(200).json({
      ok: true,
      studentId: student.id,
      student,
    });
  } catch (err) {
    console.error("Unhandled error in /api/student/session:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
