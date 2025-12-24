import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- helpers ---
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
    if (!json.trim().startsWith("{")) json = base64UrlDecode(token);
    const data = JSON.parse(json);

    const teacher_id = data.teacher_id || data.teacherId;
    if (!teacher_id) return null;

    return { teacher_id, role: data.role || "teacher" };
  } catch {
    return null;
  }
}

// --- handler ---
export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    // ADMIN: all classes
    if (isAdmin) {
      const { data: classes, error } = await supabaseAdmin
        .from("classes")
        .select("id, class_label")
        .order("class_label", { ascending: true });

      if (error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load classes",
          debug: error.message,
        });
      }

      return res.json({ ok: true, classes: classes || [] });
    }

    // TEACHER: only mapped classes
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (linkErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to read teacher_classes",
        debug: linkErr.message,
      });
    }

    const classIds = (links || []).map((l) => l.class_id).filter(Boolean);
    if (!classIds.length) {
      return res.json({ ok: true, classes: [] });
    }

    const { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .in("id", classIds)
      .order("class_label", { ascending: true });

    if (cErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load classes",
        debug: cErr.message,
      });
    }

    return res.json({ ok: true, classes: classes || [] });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e),
    });
  }
}
