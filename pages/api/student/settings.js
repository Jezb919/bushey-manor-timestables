// pages/api/student/settings.js
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

    if (!sess?.class_id) {
      return res.status(200).json({
        ok: true,
        signedIn: true,
        settings: null,
        error: "Student has no class assigned",
        session: sess,
      });
    }

    // safest: select * so we don’t get caught by column naming differences
    const { data: cls, error } = await supabaseAdmin
      .from("classes")
      .select("*")
      .eq("id", sess.class_id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ ok: false, error: "Database error", debug: error.message });
    }

    if (!cls) {
      return res.status(200).json({ ok: true, signedIn: true, settings: null, error: "Class not found" });
    }

    // Normalise keys
    const class_label = cls.class_label ?? cls["class label"] ?? null;
    const year_group = cls.year_group ?? cls["year group"] ?? null;
    const minimum_table = cls.minimum_table ?? cls["minimum table"] ?? null;
    const maximum_table = cls.maximum_table ?? cls["maximum table"] ?? null;
    const test_start_date = cls.test_start_date ?? cls["test start date"] ?? null;

    return res.status(200).json({
      ok: true,
      signedIn: true,
      settings: {
        class_id: cls.id,
        class_label,
        year_group,
        minimum_table,
        maximum_table,
        test_start_date,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
