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

async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");

  const token = cookies["bmtt_teacher"] || cookies["bmtt_session"];
  if (!token) return null;

  try {
    let json = token;
    if (!json.trim().startsWith("{")) {
      json = base64UrlDecode(token);
    }
    const data = JSON.parse(json);

    if (!data.teacher_id) return null;

    return {
      teacher_id: data.teacher_id,
      role: data.role || "teacher",
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { class_label, debug } = req.query;

    // ✅ Safe debug mode: shows which cookie NAMES the API receives (not values)
    if (debug === "1") {
      const cookies = parseCookies(req.headers.cookie || "");
      return res.json({
        ok: true,
        received_cookie_header: !!req.headers.cookie,
        received_cookie_names: Object.keys(cookies),
        note:
          "If bmtt_session/bmtt_teacher are missing here, your cookies are not being sent to /api (usually Path is not '/').",
      });
    }

    const session = await getTeacherFromSession(req);
    if (!session) {
      const cookies = parseCookies(req.headers.cookie || "");
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
        received_cookie_header: !!req.headers.cookie,
        received_cookie_names: Object.keys(cookies),
        next_step:
          "Open /api/teacher/settings?debug=1 and tell me what cookie names you see. If bmtt_* are missing, we must change the cookie Path to '/'.",
      });
    }

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    const { data: cls, error: classErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", class_label)
      .single();

    if (classErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    if (!isAdmin) {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", teacher_id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (linkErr) {
        return res
          .status(500)
          .json({ ok: false, error: "Access check failed", debug: linkErr.message });
      }

      if (!link) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this class",
          debug: { teacher_id, role, class_label },
        });
      }
    }

    const { data: settings } = await supabaseAdmin
      .from("teacher_settings")
      .select("*")
      .eq("class_id", cls.id)
      .maybeSingle();

    return res.json({ ok: true, class: cls, settings: settings || null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
