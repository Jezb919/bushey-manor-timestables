// pages/api/admin/pupils/reset_pin.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

function makePin() {
  // 4-digit PIN, first digit not 0
  const first = Math.floor(Math.random() * 9) + 1;
  const rest = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${first}${rest}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const adminCheck = await requireAdmin(req, res);
  if (!adminCheck.ok) return; // requireAdmin already responded

  try {
    const { student_id } = req.body || {};
    if (!student_id) return res.status(400).json({ ok: false, error: "Missing student_id" });

    // Get student (so we can show username on success)
    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, username, first_name, last_name")
      .eq("id", student_id)
      .single();

    if (sErr || !student) {
      return res.status(404).json({ ok: false, error: "Student not found", debug: sErr?.message });
    }

    const newPin = makePin();

    // Your project previously used plain compare in places. We'll store plain in a column.
    // Try common column names in order: pin, pin_code, pin_hash
    // (Supabase will error if column doesn't exist, so we attempt carefully.)
    const attempts = [
      { col: "pin", value: newPin },
      { col: "pin_code", value: newPin },
      { col: "pin_hash", value: newPin }, // if you kept the name pin_hash but you're doing plain compare
    ];

    let updated = null;
    let lastErr = null;

    for (const a of attempts) {
      const { data, error } = await supabaseAdmin
        .from("students")
        .update({ [a.col]: a.value })
        .eq("id", student_id)
        .select("id")
        .single();

      if (!error) {
        updated = data;
        lastErr = null;
        break;
      }
      lastErr = error;
    }

    if (!updated) {
      return res.status(500).json({
        ok: false,
        error: "Could not save PIN (no compatible column found)",
        debug: lastErr?.message || "Unknown error",
      });
    }

    return res.json({
      ok: true,
      student: {
        id: student.id,
        username: student.username,
        first_name: student.first_name,
        last_name: student.last_name,
      },
      pin: newPin, // IMPORTANT: show once so you can copy it
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
