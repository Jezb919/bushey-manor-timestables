import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getTeacherFromCookie(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return {
      teacher_id: obj.teacher_id || obj.teacherId || obj.id || null,
      role: obj.role || null,
      email: obj.email || null,
      full_name: obj.full_name || obj.fullName || null,
    };
  } catch {
    return null;
  }
}

function extractTableNumber(record) {
  // Try common column names first
  const candidates = [
    record.table_number,
    record.table,
    record.table_times,
    record.times_table,
    record.tableValue,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 1 && n <= 19) return n;
  }

  // Try parsing a question string like "7 x 8" or "7×8"
  const q = record.question || record.prompt || record.q || "";
  if (typeof q === "string" && q.length) {
    const m = q.match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      // Usually the "table" is the first number (7x8 is 7-times table)
      if (Number.isFinite(a) && a >= 1 && a <= 19) return a;
      if (Number.isFinite(b) && b >= 1 && b <= 19) return b;
    }
  }

  return null;
}

function isCorrect(record) {
  // Common booleans
  if (typeof record.is_correct === "boolean") return record.is_correct;
  if (typeof record.correct === "boolean") return record.correct;

  // Sometimes stored as 0/1 or "true"/"false"
  if (record.is_correct === 1 || record.correct === 1) return true;
  if (record.is_correct === 0 || record.correct === 0) return false;

  if (record.is_correct === "true" || record.correct === "true") return true;
  if (record.is_correct === "false" || record.correct === "false") return false;

  // Try comparing answers if present
  const ua = record.user_answer ?? record.answer ?? record.given_answer;
  const ca = record.correct_answer ?? record.expected_answer;
  if (ua != null && ca != null) return String(ua).trim() === String(ca).trim();

  return null;
}

export default async function handler(req, res) {
  try {
    const { student_id, debug } = req.query;

    if (!student_id) {
      return res.status(400).json({ ok: false, error: "Missing student_id" });
    }

    const me = getTeacherFromCookie(req);
    if (!me?.teacher_id) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    // 1) Load the pupil
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("*")
      .eq("id", student_id)
      .single();

    if (pupilErr || !pupil) {
      return res.status(404).json({ ok: false, error: "Pupil not found", debug: pupilErr?.message });
    }

    // 2) Permission check (teacher must be linked to pupil’s class_id)
    if (me.role !== "admin") {
      const classId = pupil.class_id;
      if (!classId) {
        return res.status(403).json({ ok: false, error: "Pupil has no class_id (cannot permission-check)" });
      }

      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", me.teacher_id)
        .eq("class_id", classId)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({ ok: false, error: "Permission check failed", debug: linkErr.message });
      }
      if (!link) {
        return res.status(403).json({ ok: false, error: "Not allowed for this pupil" });
      }
    }

    // 3) Load attempts (last 20)
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("id, student_id, created_at, score")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);

    // 4) Load question records for recent attempts (for heatmap)
    // Use select("*") to avoid “column does not exist” crashes.
    let qrecs = [];
    if (attemptIds.length) {
      const { data: qr, error: qrErr } = await supabaseAdmin
        .from("question_records")
        .select("*")
        .in("attempt_id", attemptIds)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (qrErr) {
        // Instead of hard failing the whole page, return empty heatmap and show a message
        if (debug === "1") {
          return res.status(500).json({
            ok: false,
            error: "Failed to load question records",
            debug: qrErr.message,
            note: "question_records query failed — send this debug to me.",
          });
        }
        qrecs = [];
      } else {
        qrecs = qr || [];
      }
    }

    // 5) Build chart series (oldest -> newest)
    const series = (attempts || [])
      .slice()
      .reverse()
      .map((a) => ({
        date: a.created_at,
        score: Number.isFinite(Number(a.score)) ? Math.round(Number(a.score)) : null,
      }))
      .filter((x) => x.score !== null);

    // 6) Heatmap: rows 1..19, cols = most recent attempts (max 8 to keep it readable)
    const cols = (attempts || []).slice(0, 8); // most recent first
    const colIds = cols.map((a) => a.id);

    // Map: attempt_id -> array of qrecs
    const qByAttempt = new Map();
    for (const r of qrecs) {
      const aid = r.attempt_id;
      if (!colIds.includes(aid)) continue;
      if (!qByAttempt.has(aid)) qByAttempt.set(aid, []);
      qByAttempt.get(aid).push(r);
    }

    const heatmap = [];
    for (let table = 1; table <= 19; table++) {
      const row = [];
      for (const a of cols) {
        const list = qByAttempt.get(a.id) || [];
        let total = 0;
        let correct = 0;

        for (const rec of list) {
          const t = extractTableNumber(rec);
          if (t !== table) continue;

          const ok = isCorrect(rec);
          if (ok === null) continue;

          total += 1;
          if (ok) correct += 1;
        }

        const percent = total ? Math.round((correct / total) * 100) : null;
        row.push({ attempt_id: a.id, date: a.created_at, percent, total });
      }
      heatmap.push({ table, cells: row });
    }

    // 7) Recent question records (last 50) — safe preview
    const recentQuestionRecords = qrecs.slice(0, 50);

    return res.json({
      ok: true,
      me,
      pupil,
      attempts: attempts || [],
      series,
      heatmap,
      recentQuestionRecords,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
