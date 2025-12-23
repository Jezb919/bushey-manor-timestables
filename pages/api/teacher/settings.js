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
 */
async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return null;

  try {
    // 1) Try plain JSON
    if (token.trim().startsWith("{")) {
      const data = JSON.parse(token);
      if (data.teacher_id) {
        return {
          teacher_id: data.teacher_id,
          role: data.role || "teacher",
        };
      }
    }

    // 2) Try base64 JSON
    const decoded = base64UrlDecode(token);
    const data = JSON.parse(decoded);

    if (!data.teacher_id) return null;

    return {
      teacher_id: data.teacher_id,
      role: data.role || "teacher",
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/teacher/settings
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
        if (looksLikeJson) {
          parsedKeys = Object.keys(JSON.parse(raw));
        }
      } catch {}

      try {
        if (!parsedKeys && raw) {
          const decoded = base64UrlDecode(raw);
          parsedKeys = Object.keys(JSON.parse(decoded));
        }
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
        note:
          "parsedKeys shows field names only. If teacher_id is not listed, tell me what keys ARE listed.",
      });
    }

    /**
     * Normal execution
     */
    const session = await getTeacherFromSession(req);
    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
      });
    }

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // Look up class
    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({
        ok: false,
        error: "Class not found",
      });
    }

    // Permission check
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

    // Fetch settings
    const { data: settings } = await supabaseAdmin
      .from("teacher_settings")
      .select("*")
      .eq("class_id", cls.id)
      .maybeSingle();

    return res.json({
      ok: true,
      class: cls,
      settings: settings || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e),
    });
  }
}
