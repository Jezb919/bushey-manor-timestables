import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(name + "="));
  if (!found) return null;
  return decodeURIComponent(found.split("=").slice(1).join("="));
}

function getTeacherFromCookie(req) {
  const token = parseCookie(req, "bmtt_teacher");
  if (!token) return null;
  try {
    const obj = JSON.parse(token);
    const teacher_id = obj.teacher_id || obj.teacherId;
    const role = obj.role || "teacher";
    if (!teacher_id) return null;
    return { teacher_id, role };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { student_id, debug } = req.query;

    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    const session = getTeacherFromCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // Load student (need class_id for permission)
    const { data: student, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_id, class_label")
      .eq("id", student_id)
      .single();

    if (sErr || !student) {
      return res.status(404).json({
        ok: false,
        error: "Failed to load pupil",
        debug: sErr?.message,
      });
    }

    // Permission: admin ok; teacher must be linked to student's class
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", student.class_id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Permission check failed",
          debug: linkErr.message,
        });
      }

      if (!link) {
        return res.status(403).json({
          ok: false,
          error: "Not allowed for this pupil",
        });
      }
    }

    // Load most recent attempts (last 8 is plenty for a nice grid)
    const { data: attempts, error: aErr } = await supabaseAdmin
      .from("attempts")
      .select("id, created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (aErr) {
      return res
        .status(500)
        .json({ ok: false, error: "Failed to load attempts", debug: aErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);

    // No attempts yet
    if (!attemptIds.length) {
      return res.json({
        ok: true,
        student: {
          id: student.id,
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        },
        attempts: [],
        tables: Array.from({ length: 19 }, (_, i) => i + 1),
        grid: [],
      });
    }

    // question_records expected columns: attempt_id, table_number, is_correct (or correct)
    const { data: qr, error: qErr } = await supabaseAdmin
      .from("question_records")
      .select("attempt_id, table_number, is_correct")
      .in("attempt_id", attemptIds);

    if (qErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load question records",
        debug: qErr.message,
      });
    }

    // Build map: attempt_id -> table_number -> {correct,total}
    const map = {};
    for (const row of qr || []) {
      const aid = row.attempt_id;
      const t = Number(row.table_number);
      if (!aid || !t) continue;
      if (!map[aid]) map[aid] = {};
      if (!map[aid][t]) map[aid][t] = { correct: 0, total: 0 };
      map[aid][t].total += 1;
      if (row.is_correct === true) map[aid][t].correct += 1;
    }

    const tables = Array.from({ length: 19 }, (_, i) => i + 1);

    // columns = attempts in date order (oldest -> newest looks nicer in a heatmap)
    const cols = [...(attempts || [])].reverse().map((a) => ({
      id: a.id,
      date: a.created_at,
    }));

    // grid: rows (tables) x cols (attempts)
    const grid = tables.map((t) => {
      const cells = cols.map((col) => {
        const stat = map[col.id]?.[t];
        if (!stat || !stat.total) return null;
        const pct = Math.round((stat.correct / stat.total) * 100);
        return { pct, correct: stat.correct, total: stat.total };
      });
      return { table: t, cells };
    });

    return res.json({
      ok: true,
      student: {
        id: student.id,
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "(no name)",
      },
      attempts: cols,
      tables,
      grid,
      ...(debug ? { debug: { attemptIds } } : {}),
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: "Server error", debug: String(e) });
  }
}
