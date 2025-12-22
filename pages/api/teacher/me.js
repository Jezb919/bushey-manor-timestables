// pages/api/teacher/me.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    const rawCookie = req.cookies?.bmtt_teacher;

    if (!rawCookie) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Robust cookie parsing (handles quoted / escaped cookies)
    let session;
    try {
      session = JSON.parse(rawCookie);
    } catch {
      try {
        session = JSON.parse(String(rawCookie).replace(/^"|"$/g, ""));
      } catch {
        return res.status(200).json({ ok: true, loggedIn: false });
      }
    }

    const teacherId = session?.teacherId;
    if (!teacherId) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Load teacher
    const { data: teacher, error: teacherErr } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .eq("id", teacherId)
      .single();

    if (teacherErr || !teacher) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Load classes teacher has access to
    // Admin sees all classes
    let classesQuery = supabase
      .from("classes")
      .select("id, class_label, year_group")
      .order("year_group", { ascending: true })
      .order("class_label", { ascending: true });

    if (teacher.role !== "admin") {
      // Non-admin: only assigned classes
      const { data: teacherClasses, error: tcErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      if (tcErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load teacher classes",
          details: tcErr.message,
        });
      }

      const classIds = teacherClasses.map((c) => c.class_id);

      if (classIds.length === 0) {
        return res.status(200).json({
          ok: true,
          loggedIn: true,
          teacher,
          classes: [],
        });
      }

      classesQuery = classesQuery.in("id", classIds);
    }

    const { data: classes, error: classesErr } = await classesQuery;

    if (classesErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load classes",
        details: classesErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      loggedIn: true,
      teacher,
      classes: classes || [],
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
