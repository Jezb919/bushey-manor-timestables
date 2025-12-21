// pages/api/teacher/me.js
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const COOKIE_NAME = "bmtt_session";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("="));
  });
  return out;
}

function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const secret = process.env.SESSION_SECRET || "dev-secret-change-me";
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (expected !== sig) return null;

  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return obj;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);

    if (!sess?.teacher_id) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Load teacher
    const { data: teacher, error: tErr } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("id", sess.teacher_id)
      .maybeSingle();

    if (tErr) {
      return res.status(500).json({ ok: false, error: "Failed to load teacher", details: tErr.message });
    }

    if (!teacher) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Load assigned classes (admin gets all)
    let classes = [];
    if (teacher.role === "admin") {
      const { data: allClasses, error: cErr } = await supabase
        .from("classes")
        .select("id, class_label, year_group")
        .order("year_group", { ascending: true })
        .order("class_label", { ascending: true });

      if (cErr) {
        return res.status(500).json({ ok: false, error: "Failed to load classes", details: cErr.message });
      }
      classes = allClasses || [];
    } else {
      const { data: links, error: lErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      if (lErr) {
        return res.status(500).json({ ok: false, error: "Failed to load teacher_classes", details: lErr.message });
      }

      const ids = (links || []).map((x) => x.class_id);
      if (ids.length) {
        const { data: someClasses, error: cErr } = await supabase
          .from("classes")
          .select("id, class_label, year_group")
          .in("id", ids)
          .order("year_group", { ascending: true })
          .order("class_label", { ascending: true });

        if (cErr) {
          return res.status(500).json({ ok: false, error: "Failed to load classes", details: cErr.message });
        }
        classes = someClasses || [];
      }
    }

    return res.status(200).json({
      ok: true,
      loggedIn: true,
      teacher,
      classes,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error", details: String(err?.message || err) });
  }
}
