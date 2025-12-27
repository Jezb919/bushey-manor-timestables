import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeCookie(name, value) {
  // 30 days
  const maxAge = 60 * 60 * 24 * 30;
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const username = (body.username || "").trim();
    const pin = (body.pin || "").trim();

    if (!username || !pin) {
      return res.status(400).json({ ok: false, error: "Missing username or pin" });
    }

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_label, username, pin")
      .eq("username", username)
      .single();

    if (error || !student) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // PIN compare (stored as text or number)
    const storedPin = String(student.pin ?? "");
    if (storedPin !== String(pin)) {
      return res.status(401).json({ ok: false, error: "Invalid login" });
    }

    // Set cookie with student_id
    const payload = JSON.stringify({
      student_id: student.id,
      username: student.username,
      class_label: student.class_label,
      first_name: student.first_name,
      last_name: student.last_name,
    });

    res.setHeader("Set-Cookie", makeCookie("bmtt_student", payload));

    return res.json({ ok: true, student: { ...student, pin: undefined } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
