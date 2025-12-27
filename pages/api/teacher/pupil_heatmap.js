import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function getTeacherFromCookie(req) {
  const cookies = parseCookies(req);
  const token = cookies.bmtt_teacher || "";
  if (!token) return null;

  try {
    const obj = JSON.parse(token);
    const teacher_id = obj.teacher_id || obj.teacherId;
    const role = obj.role || "teacher";
    return teacher_id ? { teacher_id, role } : null;
  } catch {
    return null;
  }
}

// pull a value from a row using several possible key names
function pick(row, keys) {
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  return undefined;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const { student_id } = req.query;
    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    const session = getTeacherFromCookie(req);
    if (!session?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // get student (for class_label + permissions)
    const { data: student, error: stuErr } = await supabaseAdmin
      .from("students")
      .select("id, class_label")
      .eq("id", student_id)
      .single();

    if (stuErr || !student) {
      return res.status(404).json({ ok: false, error: "Pupil not found", debug: stuErr?.message });
    }

    // class lookup
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from("classes")
      .select("id, class_label")
      .eq("class_label", student.class_label)
      .single();

    if (clsErr || !cls) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    // permission check for teacher (admin sees all)
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", cls.id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!link) {
        return res.status(403).json({ ok: false, error: "Not allowed for this pupil" });
      }
    }

    // load most recent attempts for pupil
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("id, created_at")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);
    if (!attemptIds.length) {
      return res.json({
        ok: true,
        attempts: [],
        tables: Array.from({ length: 19 }, (_, i) => i + 1),
        matrix: {},
      });
    }

    // pull ALL columns from question_records so we don’t crash on “missing column”
    const { data: qrecs, error: qrErr } = await supabaseAdmin
      .from("question_records")
      .select("*")
      .in("attempt_id", attemptIds);

    if (qrErr) {
      return res.status(500).json({ ok: false, error: "Failed to load question records", debug: qrErr.message });
    }

    const tableKeys = ["table", "table_number", "times_table", "timesTable", "table_no", "table_num"];
    const correctKeys = ["is_correct", "correct", "was_correct", "isCorrect"];

    // matrix[table][attempt_id] = percent
    const matrix = {};
    for (let t = 1; t <= 19; t++) matrix[t] = {};

    // counts per (attempt, table)
    const counts = {}; // `${attemptId}:${table}` -> { total, correct }

    (qrecs || []).forEach((r) => {
      const attemptId = r.attempt_id;

      // try to derive table number
      let table = pick(r, tableKeys);

      // some schemas store factors instead (fallback)
      if (typeof table !== "number") {
        const b = pick(r, ["b", "multiplier", "times", "table_value"]);
        if (typeof b === "number") table = b;
      }

      table = Number(table);
      if (!Number.isFinite(table) || table < 1 || table > 19) return;

      // try to derive correctness
      let isCorrect = pick(r, correctKeys);

      if (typeof isCorrect !== "boolean") {
        // sometimes stores 0/1
        if (isCorrect === 1) isCorrect = true;
        else if (isCorrect === 0) isCorrect = false;
      }

      const key = `${attemptId}:${table}`;
      if (!counts[key]) counts[key] = { total: 0, correct: 0 };
      counts[key].total += 1;
      if (isCorrect === true) counts[key].correct += 1;
    });

    // build %s
    attemptIds.forEach((aid) => {
      for (let t = 1; t <= 19; t++) {
        const key = `${aid}:${t}`;
        const c = counts[key];
        if (!c || !c.total) continue;
        const pct = Math.round((c.correct / c.total) * 100);
        matrix[t][aid] = pct;
      }
    });

    return res.json({
      ok: true,
      attempts: (attempts || []).map((a) => ({ attempt_id: a.id, created_at: a.created_at })),
      tables: Array.from({ length: 19 }, (_, i) => i + 1),
      matrix,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
