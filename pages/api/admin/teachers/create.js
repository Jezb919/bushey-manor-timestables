// pages/api/admin/teachers/create.js
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../lib/requireAdmin";

/**
 * POST JSON:
 * {
 *   full_name: "Susan Lowden",
 *   email: "s.lowden@busheyfederation.org.uk",
 *   role: "teacher" | "admin",
 *   class_label: "B3" // optional (admins may leave blank)
 * }
 */
export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return; // requireAdmin already responded

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed (POST only)",
        info:
          "Send JSON: { full_name, email, role, class_label? }",
      });
    }

    const { full_name, email, role, class_label } = req.body || {};

    if (!full_name || !email || !role) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields",
        debug: { full_name: !!full_name, email: !!email, role: !!role },
      });
    }

    if (!["teacher", "admin"].includes(role)) {
      return res.status(400).json({ ok: false, error: "Invalid role" });
    }

    // 1) Create teacher row
    const insertTeacher = await supabaseAdmin
      .from("teachers")
      .insert({
        full_name,
        email: String(email).toLowerCase().trim(),
        role,
      })
      .select("id, full_name, email, role")
      .single();

    if (insertTeacher.error) {
      return res.status(400).json({
        ok: false,
        error: "Failed to create teacher",
        debug: insertTeacher.error.message,
      });
    }

    const teacher = insertTeacher.data;

    // 2) If class_label provided AND role is teacher, write mapping in teacher_classes
    //    (Admins can leave blank)
    if (role === "teacher" && class_label && String(class_label).trim() !== "") {
      const label = String(class_label).trim();

      const cls = await supabaseAdmin
        .from("classes")
        .select("id, class_label")
        .eq("class_label", label)
        .single();

      if (cls.error || !cls.data) {
        return res.status(400).json({
          ok: false,
          error: "Teacher created, but class not found",
          debug: cls.error ? cls.error.message : "No class row returned",
          teacher,
        });
      }

      // Upsert mapping (one class per teacher)
      const map = await supabaseAdmin
        .from("teacher_classes")
        .upsert(
          { teacher_id: teacher.id, class_id: cls.data.id },
          { onConflict: "teacher_id" }
        )
        .select("teacher_id, class_id")
        .single();

      if (map.error) {
        return res.status(400).json({
          ok: false,
          error: "Teacher created, but failed to assign class",
          debug: map.error.message,
          teacher,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      teacher,
      info:
        "Teacher created. If you selected a class, it is stored in teacher_classes (not in teachers).",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: e?.message || String(e),
    });
  }
}
