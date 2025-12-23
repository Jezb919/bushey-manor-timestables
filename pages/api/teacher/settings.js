import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (server-side only)
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Cookie helpers
 */
function parseCookies(cookieHeader = "") {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function base64UrlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Read logged-in teacher from cookies
 * Supports:
 * - bmtt_teacher (JSON or base64 JSON) containing teacherId (and optionally role)
 * - bmtt_session (fallback)
 */
async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return null;

  try {
    // 1) Try plain JSON
    if (token.trim().startsWith("{")) {
      const data = JSON.parse(token);
      const teacher_id = data.teacher_id || data.teacherId;
      if (!teacher_id) return null;

      return {
        teacher_id,
        role: data.role || "teacher",
      };
    }

    // 2) Try base64 JSON
    const decoded = base64UrlDecode(token);
    const data = JSON.parse(decoded);
    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;

    return {
      teacher_id,
      role: data.role || "teacher",
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/teacher/settings?class_label=M4
 * (also supports ?debug=1)
 */
export default async function handler(req, res) {
  try {
    const { class_label, debug } = req.query;

    /**
     * DEBUG MODE — SAFE
     * Shows cookie names + token structure ONLY (no secrets)
     */
    if (debug === "1") {
      const cookies = parseCookies(req.headers.cookie || "");
      const raw = cookies["bmtt_teacher"] || cookies["bmtt_session"] || "";
      const looksLikeJson = raw.trim().startsWith("{");
      const looksLikeJwt = raw.split(".").length === 3;

      let parsedKeys = null;
      try {
        if (looksLikeJson) parsedKeys = Object.keys(JSON.parse(raw));
      } catch {}

      try {
        if (!parsedKeys && raw) parsedKeys = Object.keys(JSON.parse(base64UrlDecode(raw)));
      } catch {}

      return res.json({
        ok: true,
        received_cookie_names: Object.keys(cookies),
        token_source: cookies["bmtt_teacher"]
          ? "bmtt_teacher"
          : cookies["bmtt_session"]
          ? "bmtt_session"
          : "none",
        looksLikeJson,
        looksLikeJwt,
        parsedKeys,
      });
    }

    /**
     * Normal execution
     */
    const session = await getTeacherFromSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // 1) Look up class by label (M4)
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // 2) Permission check (teacher_classes uses class_id)
    if (!isAdmin) {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Access check failed",
          debug: linkErr.message,
        });
      }

      if (!link) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this class",
          debug: { teacher_id, role, class_label },
        });
      }
    }

    // 3) Fetch settings (teacher_settings uses teacher_id + class_label)
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("teacher_settings")
      .select("*")
      .eq("teacher_id", teacher_id)
      .eq("class_label", cls.class_label)
      .maybeSingle();

    if (settingsErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load settings",
        debug: settingsErr.message,
      });
    }

    return res.json({
      ok: true,
      class: cls,
      settings: settings || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
