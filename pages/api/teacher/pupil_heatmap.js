import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reads bmtt_teacher cookie and returns { teacher_id, role }
function getTeacherFromCookie(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/bmtt_teacher=([^;]+)/);
  if (!match) return null;

  try {
    const raw = decodeURIComponent(match[1]);
    const parsed = JSON.parse(raw);

    // Your cookie sometimes has teacherId and sometimes teacher_id
    const teacher_id = parsed.teacher_id || parsed.teacherId;
    const role = parsed.role;

    if (!teacher_id || !role) return null;
    return { teacher_id, role };
  } catch {
    return null;
  }
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const { student_id, debug } = req.query;

    if (!student_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing student_id",
        example: "/api/teacher/pupil_heatmap?student_id=PASTE_UUID_HERE",
      });
    }

    if (!isUuid(student_id)) {
      return res.status(400).json({
        ok: false,
        error: "student_id must be a UUID (it looks wrong / stuck together)",
        received: String(student_id),
        tip: "If you see two UUIDs joined together, your page is building the URL incorrectly (needs fixing).",
      });
    }

    const session = getTeacherFromCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // 1) Load the student (so we know their class_label)
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, surname, class_label, class_id")
      .eq("id", student_id)
      .single();

    if (pupilErr || !pupil) {
      return res.status(404).json({
        ok: false,
        error: "Failed to load pupil",
        debug: pupilErr?.message || "Not found",
      });
    }

    // 2) Permission:
    // - admin can see all
    // - teacher must be mapped to this class_id in teacher_classes
    if (session.role !== "admin") {
      // We support both styles:
      // A) teacher_classes uses class_id
      // B) if your data is still label-based, you can change to class_label (but your earlier error suggests class_id is correct)
      const classId = pupil.class_id;

      if (!classId || !isUuid(classId)) {
        return res.status(500).json({
          ok: false,
          error: "Pupil class_id missing (students.class_id not set)",
          debug: { student_id, class_id: classId, class_label: pupil.class_label },
        });
      }

      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", classId)
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
          debug: {
            teacher_id: session.teacher_id,
            role: session.role,
            pupil_class_id: classId,
          },
        });
      }
    }

    // 3) Get the most recent attempts for this student (latest first)
    // NOTE: your attempts table name is "attempts"
    // We assume it has: student_id, created_at, score (or percent)
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("id, created_at, score, percent, percentage")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (attErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load attempts",
        debug: attErr.message,
      });
    }

    // No attempts yet? Return an empty heatmap but still ok=true
    if (!attempts || attempts.length === 0) {
      return res.json({
        ok: true,
        pupil: {
          id: pupil.id,
          first_name: pupil.first_name,
          surname: pupil.surname,
          class_label: pupil.class_label,
        },
        columns: [],
        rows: Array.from({ length: 19 }, (_, i) => ({
          table: i + 1,
          cells: [],
        })),
        note: "No attempts yet for this pupil",
      });
    }

    // 4) Load question_records for those attempts
    // We assume question_records has: attempt_id, table_number (or table), is_correct (or correct)
    const attemptIds = attempts.map((a) => a.id);

    const { data: qr, error: qrErr } = await supabaseAdmin
      .from("question_records")
      .select("attempt_id, table_number, table, is_correct, correct")
      .in("attempt_id", attemptIds);

    if (qrErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load question records",
        debug: qrErr.message,
      });
    }

    // 5) Build columns (attempts) oldest->newest for left-to-right display
    const columns = [...attempts]
      .reverse()
      .map((a) => ({
        attempt_id: a.id,
        date: a.created_at,
      }));

    // Helper to read score value if present
    function getAttemptScore(a) {
      const v =
        a.percent ??
        a.percentage ??
        a.score ??
        null;
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }

    // 6) For each attempt + each table (1..19), compute success %
    // We compute from question_records (count correct / total for that table)
    const byAttempt = new Map(); // attempt_id -> rows
    for (const a of columns) byAttempt.set(a.attempt_id, []);

    for (const rec of qr || []) {
      const attempt_id = rec.attempt_id;
      const t = Number(rec.table_number ?? rec.table);
      if (!attempt_id || !Number.isFinite(t)) continue;

      const isCorrect =
        rec.is_correct === true ||
        rec.correct === true ||
        rec.is_correct === "true" ||
        rec.correct === "true";

      byAttempt.get(attempt_id)?.push({
        table: t,
        correct: isCorrect,
      });
    }

    const rows = [];
    for (let table = 1; table <= 19; table++) {
      const cells = [];

      for (const col of columns) {
        const list = byAttempt.get(col.attempt_id) || [];
        const forTable = list.filter((x) => x.table === table);
        if (forTable.length === 0) {
          cells.push(null); // no questions of that table in that attempt
          continue;
        }
        const total = forTable.length;
        const correct = forTable.filter((x) => x.correct).length;
        const pct = Math.round((correct / total) * 100);
        cells.push(pct);
      }

      rows.push({ table, cells });
    }

    return res.json({
      ok: true,
      pupil: {
        id: pupil.id,
        first_name: pupil.first_name,
        surname: pupil.surname,
        class_label: pupil.class_label,
      },
      columns,
      rows,
      debug: debug
        ? {
            teacher: session,
            attempt_scores: attempts.map((a) => ({
              id: a.id,
              created_at: a.created_at,
              score_guess: getAttemptScore(a),
            })),
            attempts_count: attempts.length,
            question_records_count: (qr || []).length,
          }
        : undefined,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      debug: String(e),
    });
  }
}
