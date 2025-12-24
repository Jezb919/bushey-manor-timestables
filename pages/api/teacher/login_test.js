import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    const password = String(req.query.password || "");

    if (!email || !password) {
      return res.json({
        ok: false,
        error: "Missing email or password",
        example: "/api/teacher/login_test?email=admin@busheymanor.local&password=admin123",
      });
    }

    // Read the row
    const { data: teacher, error } = await supabaseAdmin
      .from("teachers")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, error: "DB error", debug: error.message });
    if (!teacher) return res.json({ ok: false, error: "No teacher found for that email" });

    // Show what columns exist (so we know what your login code should use)
    const keys = Object.keys(teacher || {});

    // Common patterns your login might be using
    const pw1 = teacher.password_hash ?? null;
    const pw2 = teacher.password ?? null;
    const pw3 = teacher.pass ?? null;

    const active = teacher.is_active ?? teacher.active ?? teacher.enabled ?? null;

    return res.json({
      ok: true,
      found: true,
      teacher_id: teacher.id,
      role: teacher.role,
      columns_present: keys,
      active_flag: active,
      password_hash_value_preview: pw1 ? String(pw1).slice(0, 20) + "..." : null,
      password_value_preview: pw2 ? String(pw2).slice(0, 20) + "..." : null,
      pass_value_preview: pw3 ? String(pw3).slice(0, 20) + "..." : null,
      matches_password_hash_plain: pw1 ? pw1 === password : false,
      matches_password_plain: pw2 ? pw2 === password : false,
      matches_pass_plain: pw3 ? pw3 === password : false,
      note:
        "If your login checks a different field (password/password_hash/pass) or requires is_active=true, this will reveal it.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
