// pages/api/teacher/admin/reset_password.js
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

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const teacher_id = String(req.body?.teacher_id || "").trim();
  const password = String(req.body?.password || "");

  if (!teacher_id || !password) {
    return res.status(400).json({ ok: false, error: "Missing teacher_id or password" });
  }

  // Use RPC so hashing happens server-side
  const { data, error } = await supabase.rpc("admin_reset_teacher_password", {
    p_teacher_id: teacher_id,
    p_password: password,
  });

  if (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to reset password",
      details: error.message,
    });
  }

  return res.status(200).json({ ok: true, updated: data === true });
}
