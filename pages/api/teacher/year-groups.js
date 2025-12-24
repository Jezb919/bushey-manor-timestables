import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  try {
    const session = await getTeacherFromSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "Not logged in" });

    const { teacher_id, role } = session;
    const isAdmin = role === "admin";

    if (isAdmin) {
      const { data, error } = await supabaseAdmin.from("classes").select("year_group");
      if (error) return res.status(500).json({ ok: false, error: "Failed to load year groups", debug: error.message });

      const years = [...new Set((data || []).map((r) => Number(r.year_group)).filter((y) => Number.isFinite(y)))]
        .sort((a, b) => a - b);

      return res.json({ ok: true, years });
    }

    // Teacher: only years that contain their classes
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (linkErr) return res.status(500).json({ ok: false, error: "Failed to read teacher_classes", debug: linkErr.message });

    const classIds = (links || []).map((l) => l.class_id).filter(Boolean);
    if (!classIds.length) return res.json({ ok: true, years: [] });

    const { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("year_group")
      .in("id", classIds);

    if (cErr) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: cErr.message });

    const years = [...new Set((classes || []).map((r) => Number(r.year_group)).filter((y) => Number.isFinite(y)))]
      .sort((a, b) => a - b);

    return res.json({ ok: true, years });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
