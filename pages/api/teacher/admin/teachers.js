// pages/api/teacher/admin/teachers.js
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

async function requireAdmin(req, res) {
  const teacherId = getTeacherIdFromCookie(req);
  if (!teacherId) return { ok: false, status: 401, msg: "Not logged in" };

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, role")
    .eq("id", teacherId)
    .maybeSingle();

  if (error || !teacher) return { ok: false, status: 401, msg: "Not logged in" };
  if (teacher.role !== "admin")
    return { ok: false, status: 403, msg: "Admin only" };

  return { ok: true, teacher };
}

export default async function handler(req, res) {
  const adminCheck = await requireAdmin(req, res);
  if (!adminCheck.ok) {
    return res
      .status(adminCheck.status)
      .json({ ok: false, error: adminCheck.msg });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, email, full_name, role")
      .order("role", { ascending: false })
      .order("email", { ascending: true });

    if (error) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to load teachers", details: error.message });
    }

    return res.status(200).json({ ok: true, teachers: data || [] });
  }

  if (req.method === "POST") {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const full_name = String(req.body?.full_name || "").trim();
    const role = String(req.body?.role || "teacher").trim();
    const password = String(req.body?.password || "");

    if (!email || !full_name || !password) {
      return res.status(400).json({
        ok: false,
        error: "Missing email, full_name, or password",
      });
    }

    if (!["admin", "teacher"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Role must be admin or teacher" });
    }

    // Create teacher with bcrypt hash (pgcrypto crypt)
    const { data: created, error } = await supabase
      .from("teachers")
      .insert({
        email,
        full_name,
        role,
        password_hash: `crypt('${password.replace(/'/g, "''")}', gen_salt('bf'))`,
      })
      .select("id, email, full_name, role")
      .single();

    // The above insert uses a raw SQL expression; Supabase JS doesn't allow that directly.
    // So we do it safely via RPC instead.
    if (error) {
      // Fallback: use SQL RPC (recommended path)
      const { data: created2, error: rpcErr } = await supabase.rpc(
        "admin_create_teacher",
        {
          p_email: email,
          p_full_name: full_name,
          p_role: role,
          p_password: password,
        }
      );

      if (rpcErr) {
        return res.status(500).json({
          ok: false,
          error: "Failed to create teacher",
          details: rpcErr.message,
        });
      }

      return res.status(200).json({ ok: true, teacher: created2 });
    }

    return res.status(200).json({ ok: true, teacher: created });
  }

  return res.status(405).json({ ok: false, error: "Use GET or POST" });
}
