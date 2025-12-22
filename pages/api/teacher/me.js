// pages/api/teacher/me.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Sort: Year asc, then M before B, then label
function sortClasses(a, b) {
  const ay = Number(a.year_group) || 0;
  const by = Number(b.year_group) || 0;
  if (ay !== by) return ay - by;

  const al = String(a.class_label || "")[0] || "";
  const bl = String(b.class_label || "")[0] || "";
  const order = { M: 0, B: 1 };
  const ao = order[al] ?? 9;
  const bo = order[bl] ?? 9;
  if (ao !== bo) return ao - bo;

  return String(a.class_label || "").localeCompare(String(b.class_label || ""));
}

export default async function handler(req, res) {
  try {
    // We store the teacher session in a cookie called "bmtt_teacher"
    // It should contain JSON like: { "teacherId": "<uuid>" }
    const rawCookie = req.cookies?.bmtt_teacher;

    if (!rawCookie) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    let session = null;
    try {
      session = JSON.parse(rawCookie);
    } catch (e) {
      // Bad cookie - treat as logged out
      return res.status(200).json({ ok: true, loggedIn: false });
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
      .maybeSingle();

    if (teacherErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load teacher",
        details: teacherErr.message,
      });
    }

    if (!teacher) {
      return res.status(200).json({ ok: true, loggedIn: false });
    }

    // Load classes based on role
    let classes = [];

    if (teacher.role === "admin") {
      // Admin: all classes
      const { data: allClasses, error: classesErr } = await supabase
        .from("classes")
        .select("id, class_label, year_group")
        .not("class_label", "is", null);

      if (classesErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load classes",
          details: classesErr.message,
        });
      }

      classes = allClasses || [];
    } else {
      // Normal teacher: only assigned classes via teacher_classes
      const { data: links, error: linkErr } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id);

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load teacher_classes",
          details: linkErr.message,
        });
      }

      const classIds = (links || []).map((l) => l.class_id).filter(Boolean);

      if (classIds.length === 0) {
        classes = [];
      } else {
        const { data: someClasses, error: classesErr } = await supabase
          .from("classes")
          .select("id, class_label, year_group")
          .in("id", classIds)
          .not("class_label", "is", null);

        if (classesErr) {
          return res.status(500).json({
            ok: false,
            error: "Failed to load classes",
            details: classesErr.message,
          });
        }

        classes = someClasses || [];
      }
    }

    classes.sort(sortClasses);

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
