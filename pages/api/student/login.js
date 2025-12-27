import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const { username, pin } = req.body || {};
    if (!username || !pin) {
      return res.status(400).json({ ok: false, error: "Missing username or PIN" });
    }

    // pin column in your table exists and may be stored as text or int
    const pinValue = String(pin).trim();

    const { data: pupil, error } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, username, pin, class_id, class_label")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "DB error", debug: error.message });
    }
    if (!pupil) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    const storedPin = pupil.pin === null || pupil.pin === undefined ? "" : String(pupil.pin);
    if (storedPin !== pinValue) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    const cookiePayload = {
      studentId: pupil.id,
      class_id: pupil.class_id,
      class_label: pupil.class_label,
      username: pupil.username,
    };

    res.setHeader("Set-Cookie", [
      `bmtt_student=${encodeURIComponent(JSON.stringify(cookiePayload))}; Path=/; SameSite=Lax`,
    ]);

    return res.json({ ok: true, pupil: { id: pupil.id, username: pupil.username } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
