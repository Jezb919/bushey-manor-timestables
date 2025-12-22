// pages/api/teacher/admin/assignments.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function getTeacherIdFromCookie(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const session = JSON.parse(decodeURIComponent(String(raw)));
    return session?.teacherId || null;
  } catch {
    return null;
  }
}

async function requireAdmin(req) {
  const teacherId = getTeacherIdFromCookie(req);
  if (!teacherId) return { ok: false, status: 401, msg: "Not logged in" };

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, role")
    .eq("id", teacherId)
    .maybeSingle();

  if (error || !teacher) return { ok: false, status: 401, msg: "Not logged in" };
  if (teacher.role !== "admin") return { ok: false, status: 403, msg: "Admin only" };
  return { ok: true };
}

export default async function handler(req, res) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) {
    return res.status(adminCheck.status).json({ ok: false, error: adminCheck.msg });
  }

  if (req.method === "GET") {
    const teacher_id = String(req.query?.teacher_id || "").trim();
    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    const { data, error } = await supabase
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacher_id);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load assignments",
        details: error.message,
      });
    }

    const classIds = (data || []).map((x) => x.class_id);
    return res.status(200).json({ ok: true, classIds });
  }

  if (req.method === "POST") {
    const teacher_id = String(req.body?.teacher_id || "").trim();
    const classIds = Array.isArray(req.body?.classIds) ? req.body.classIds : [];

    if (!teacher_id) return res.status(400).json({ ok: false, error: "Missing teacher_id" });

    // Replace assignments (simple + safe)
    const { error: delErr } = await supabase
      .from("teacher_classes")
      .delete()
      .eq("teacher_id", teacher_id);

    if (delErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to clear assignments",
        details: delErr.message,
      });
    }

    if (classIds.length === 0) {
      return res.status(200).json({ ok: true, saved: 0 });
    }

    const rows = classIds.map((class_id) => ({ teacher_id, class_id }));

    const { error: insErr } = await supabase.from("teacher_classes").insert(rows);

    if (insErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to save assignments",
        details: insErr.message,
      });
    }

    return res.status(200).json({ ok: true, saved: rows.length });
  }

  return res.status(405).json({ ok: false, error: "Use GET or POST" });
}
