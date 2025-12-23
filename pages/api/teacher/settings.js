import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (server-side only)
 * This bypasses RLS safely inside API routes
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Small helpers to read cookies + decode session
 */
function parseCookies(cookieHeader = "") {
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
 * Reads the logged-in teacher from the bmtt_session cookie
 * Must return: { teacher_id, role }
 */
async function getTeacherFromSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies["bmtt_session"];
  if (!token) return null;

  try {
    const json = base64UrlDecode(token);
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

/**
 * GET /api/teacher/settings?class_label=M4
 */
export default async function handler(req, res) {
  try {
    const { class_label } = req.query;

    // 1️⃣ Get logged-in teacher
    const session = await getTeacherFromSession(req);
    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
      });
    }

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // 2️⃣ Look up class by label (M4)
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

    // 3️⃣ Check teacher ↔ class permission
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

    // 4️⃣ Fetch settings (optional table)
    const { data: settings } = await supabaseAdmin
      .from("teacher_settings")
      .select("*")
      .eq("class_id", cls.id)
      .maybeSingle();

    // ✅ SUCCESS
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
