// pages/api/admin/teachers/list.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// Minimal admin check without extra dependencies like `cookie`
function getTeacherFromCookie(req) {
  try {
    const raw = req.cookies?.bmtt_teacher;
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed || null;
  } catch (e) {
    return null;
  }
}

function requireAdmin(req, res) {
  const t = getTeacherFromCookie(req);
  const role = t?.role;
  const teacher_id = t?.teacher_id || t?.teacherId || t?.id;

  if (!teacher_id || role !== "admin") {
    res.status(401).json({ ok: false, error: "Not authorised (admin only)" });
    return null;
  }
  return { teacher_id, role };
}

export default async function handler(req, res) {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    // 1) Load teachers
    const tRes = await supabaseAdmin
      .from("teachers")
      .select("id, full_name, email, role")
      .order("full_name", { ascending: true });

    if (tRes.error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load teachers",
        debug: tRes.error.message,
      });
    }

    const teachers = tRes.data || [];

    // 2) Load teacher -> class mapping from teacher_classes (if table exists)
    // teacher_classes assumed: teacher_id, class_id
    const tcRes = await supabaseAdmin
      .from("teacher_classes")
      .select("teacher_id, class_id");

    // If teacher_classes table doesn't exist yet, just return teachers without class_label
    if (tcRes.error) {
      return res.status(200).json({
        ok: true,
        teachers: teachers.map((t) => ({ ...t, class_label: null })),
        debug: {
          note: "teacher_classes table not readable (returning without class assignments)",
          teacher_classes_error: tcRes.error.message,
        },
      });
    }

    const teacherClassRows = tcRes.data || [];
    const classIds = Array.from(
      new Set(teacherClassRows.map((r) => r.class_id).filter(Boolean))
    );

    // 3) Load classes for those ids
    let classesById = {};
    if (classIds.length > 0) {
      const cRes = await supabaseAdmin
        .from("classes")
        .select("id, class_label")
        .in("id", classIds);

      if (cRes.error) {
        return res.status(500).json({
          ok: false,
          error: "Failed to load classes for teacher assignments",
          debug: cRes.error.message,
        });
      }

      for (const c of cRes.data || []) {
        classesById[c.id] = c.class_label;
      }
    }

    // 4) Build map teacher_id -> class_label
    const classLabelByTeacherId = {};
    for (const row of teacherClassRows) {
      if (!row.teacher_id) continue;
      classLabelByTeacherId[row.teacher_id] = row.class_id
        ? classesById[row.class_id] || null
        : null;
    }

    // 5) Attach class_label to each teacher row
    const output = teachers.map((t) => ({
      ...t,
      class_label: classLabelByTeacherId[t.id] || null,
    }));

    return res.status(200).json({
      ok: true,
      teachers: output,
      debug: {
        count: output.length,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e?.message || e),
    });
  }
}
