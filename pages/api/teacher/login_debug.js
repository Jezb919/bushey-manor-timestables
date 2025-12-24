import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function looksLikeScryptHash(s) {
  return typeof s === "string" && s.startsWith("scrypt$");
}

function verifyScrypt(password, stored) {
  // stored: scrypt$<salt>$<hash>
  try {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const test = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(test, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const email = String(req.query.email || "").trim();
    const password = String(req.query.password || "");

    if (!email || !password) {
      return res.json({
        ok: false,
        error: "Missing email or password in URL",
        example: "/api/teacher/login_debug?email=admin@busheymanor.local&password=TESTPASS",
      });
    }

    const { data: teacher, error } = await supabaseAdmin
      .from("teachers")
      .select("id, email, role, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "DB error", debug: error.message });
    }
    if (!teacher) {
      return res.json({ ok: true, found: false, note: "No teacher row found for that email" });
    }

    const stored = teacher.password_hash;

    const result = {
      ok: true,
      found: true,
      id: teacher.id,
      role: teacher.role,
      password_hash_present: !!stored,
      password_hash_preview: stored ? String(stored).slice(0, 20) + "..." : null,
      format_guess: stored
        ? looksLikeScryptHash(stored)
          ? "scrypt$SALT$HASH"
          : "unknown/plain/other"
        : "missing",
      matches_plain: stored ? stored === password : false,
      matches_scrypt: stored ? verifyScrypt(password, stored) : false,
      note:
        "If matches_scrypt is true, your teacher login must verify scrypt. If matches_plain is true, your login is plain-compare. If both false, password is different or hashing method differs.",
    };

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
