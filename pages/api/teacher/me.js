// pages/api/teacher/me.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    const raw = req.cookies?.bmtt_teacher;

    if (!raw) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Decode then parse
    let session = null;
    try {
      session = JSON.parse(decodeURIComponent(String(raw)));
    } catch {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    const teacherId = session?.teacherId;
    if (!teacherId) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    const { data: teacher, error: tErr } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("id", teacherId)
      .maybeSingle();

    if (tErr || !teacher) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Admin sees all classes. Teachers see assigned classes.
    let classes = [];

    if (teacher.role === "admin") {
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_label, year_group")
        .not("class_label", "is", null)
        .order("year_group", { ascending: true })
        .order("class_label", { ascending: true });

      if (error) {
        return res.status(500).json({ ok: false, error: "Failed to load classes", details: error.message });
      }
      classes = data || [];
    } else {
      const { data: links, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Failed to load teacher_classes", details: linkErr.message });
      }

      const classIds = (links || []).map((l) => l.class_id).filter(Boolean);

      if (classIds.length > 0) {
        const { data, error } = await supabase
          .from("classes")
          .select("id, class_label, year_group")
          .in("id", classIds)
          .not("class_label", "is", null)
          .order("year_group", { ascending: true })
          .order("class_label", { ascending: true });

        if (error) {
          return res.status(500).json({ ok: false, error: "Failed to load classes", details: error.message });
        }
        classes = data || [];
      }
    }

    return res.status(200).json({
      ok: true,
      loggedIn: true,
      teacher,
      classes,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
