// pages/api/student/session.js
import { parse } from "cookie";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    const cookies = parse(req.headers.cookie || "");
    const raw = cookies.bmtt_student;

    if (!raw) {
      return json(res, 200, { ok: true, signedIn: false });
    }

    let sess = null;
    try {
      sess = JSON.parse(raw);
    } catch {
      return json(res, 200, { ok: true, signedIn: false });
    }

    // Fetch fresh pupil info (so name/class never goes stale)
    const { data: pupil, error } = await supabaseAdmin
      .from("pupils")
      .select("id, first_name, last_name, username, class_id")
      .eq("id", sess.pupil_id || sess.pupilId)
      .single();

    if (error || !pupil) {
      return json(res, 200, { ok: true, signedIn: false });
    }

    // Also fetch class label
    const { data: cls } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("id", pupil.class_id)
      .single();

    return json(res, 200, {
      ok: true,
      signedIn: true,
      pupil: {
        id: pupil.id,
        name: `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim(),
        username: pupil.username,
        class_id: pupil.class_id,
        class_label: cls?.class_label || null,
      },
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "Server error", debug: String(e) });
  }
}
