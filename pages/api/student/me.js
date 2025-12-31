// pages/api/student/me.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req);
    const raw = cookies["bmtt_student"];
    if (!raw) return res.status(200).json({ ok: true, signedIn: false });

    let sess = null;
    try {
      sess = JSON.parse(raw);
    } catch {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    if (!sess?.studentId) return res.status(200).json({ ok: true, signedIn: false });

    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("id, username, first_name, surname, last_name, class_id, active")
      .eq("id", sess.studentId)
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, error: "Database error", debug: error.message });
    if (!student) return res.status(200).json({ ok: true, signedIn: false });
    if (student.active === false) return res.status(200).json({ ok: true, signedIn: false });

    let class_label = sess.class_label ?? null;
    if (!class_label && student.class_id) {
      const { data: cls } = await supabaseAdmin
        .from("classes")
        .select("class_label")
        .eq("id", student.class_id)
        .maybeSingle();
      class_label = cls?.class_label ?? null;
    }

    return res.status(200).json({
      ok: true,
      signedIn: true,
      student: {
        id: student.id,
        username: student.username,
        class_id: student.class_id,
        class_label,
        name: [student.first_name, student.last_name || student.surname].filter(Boolean).join(" "),
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
