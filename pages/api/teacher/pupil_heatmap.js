import { createClient } from "@supabase/supabase-js";

/**
 * Uses Service Role so we can read everything server-side.
 * Make sure SUPABASE_SERVICE_ROLE_KEY is set in Vercel.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---- cookie/session helper (matches how your app has been working)
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function getTeacherFromCookie(req) {
  const cookies = parseCookies(req);
  const raw = cookies.bmtt_teacher || cookies.bmtt_session;
  if (!raw) return null;

  // bmtt_teacher has been JSON in your setup
  try {
    const obj = JSON.parse(raw);
    const teacher_id = obj.teacher_id || obj.teacherId || obj.id;
    const role = obj.role || "teacher";
    return teacher_id ? { teacher_id, role } : null;
  } catch (e) {
    return null;
  }
}

function formatAttemptLabel(created_at, usedLabels) {
  // dd/mm/yyyy; if duplicate day, add hh:mm
  const d = new Date(created_at);
  const day = d.toLocaleDateString("en-GB");
  if (!usedLabels.has(day)) {
    usedLabels.add(day);
    return day;
  }
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const label = `${day} ${time}`;
  usedLabels.add(label);
  return label;
}

function pickTableNumber(row) {
  // Try common column names
  const v =
    row.table_number ??
    row.table ??
    row.times_table ??
    row.table_value ??
    row.tableSelected ??
    row.tables_selected ??
    row.tables_included;

  // Sometimes it’s stored as "7×" or "7x"
  if (typeof v === "string") {
    const m = v.match(/(\d{1,2})/);
    if (m) return parseInt(m[1], 10);
  }

  if (typeof v === "number") return v;

  return null;
}

function pickIsCorrect(row) {
  // Try common boolean fields
  const v =
    row.is_correct ??
    row.correct ??
    row.isCorrect ??
    row.was_correct ??
    row.answer_correct ??
    row.is_right;

  if (typeof v === "boolean") return v;

  // Sometimes string "true"/"false" or "correct"/"incorrect"
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (s === "true" || s === "yes" || s === "correct") return true;
    if (s === "false" || s === "no" || s === "incorrect") return false;
  }

  // Sometimes numeric 1/0
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }

  return null;
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

    // 1) Load pupil
    const { data: pupil, error: pupilErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name, class_id, class_label")
      .eq("id", student_id)
      .maybeSingle();

    if (pupilErr || !pupil) {
      return res.status(404).json({
        ok: false,
        error: "Pupil not found",
        debug: pupilErr?.message || "No row"
      });
    }

    // 2) Permission check (admin sees all; teacher must be linked to class_id)
    if (session.role !== "admin") {
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("teacher_classes")
        .select("teacher_id, class_id")
        .eq("teacher_id", session.teacher_id)
        .eq("class_id", pupil.class_id)
        .maybeSingle();

      if (linkErr) {
        return res.status(500).json({
          ok: false,
          error: "Permission check failed",
          debug: linkErr.message
        });
      }

      if (!link) {
        return res.status(403).json({ ok: false, error: "Not allowed for this class" });
      }
    }

    // 3) Load recent attempts for this pupil
    const LIMIT_ATTEMPTS = 8; // tweak if you want more columns
    const { data: attempts, error: attErr } = await supabaseAdmin
      .from("attempts")
      .select("id, created_at")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(LIMIT_ATTEMPTS);

    if (attErr) {
      return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: attErr.message });
    }

    const attemptIds = (attempts || []).map((a) => a.id);

    // Build column labels (most recent first)
    const usedLabels = new Set();
    const columns = (attempts || []).map((a) => formatAttemptLabel(a.created_at, usedLabels));

    // If no attempts, return an empty heatmap (still shows rows 1–19)
    if (!attemptIds.length) {
      const rows = Array.from({ length: 19 }, (_, i) => ({
        table: i + 1,
        cells: []
      }));
      return res.json({ ok: true, heatmap: { columns: [], rows } });
    }

    // 4) Load question records for those attempts
    // We select "*" so we can adapt to whatever your column names are.
    const { data: qrs, error: qrErr } = await supabaseAdmin
      .from("question_records")
      .select("*")
      .in("attempt_id", attemptIds);

    if (qrErr) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load question records",
        debug: qrErr.message
      });
    }

    // 5) Aggregate: attempt_id -> table -> {correct,total}
    const agg = new Map(); // attemptId => Map(table => {c,t})
    const unknownSamples = [];

    for (const row of qrs || []) {
      const aId = row.attempt_id;
      const table = pickTableNumber(row);
      const isCorrect = pickIsCorrect(row);

      if (!aId || table == null || isCorrect == null) {
        if (debug && unknownSamples.length < 5) {
          unknownSamples.push({
            keys: Object.keys(row),
            attempt_id: row.attempt_id ?? null,
            table_guess: table,
            correct_guess: isCorrect
          });
        }
        continue;
      }

      if (table < 1 || table > 19) continue;

      if (!agg.has(aId)) agg.set(aId, new Map());
      const perAttempt = agg.get(aId);

      if (!perAttempt.has(table)) perAttempt.set(table, { c: 0, t: 0 });
      const cell = perAttempt.get(table);

      cell.t += 1;
      if (isCorrect) cell.c += 1;
    }

    // 6) Build rows 1–19, with a cell per attempt column
    const rows = Array.from({ length: 19 }, (_, idx) => {
      const table = idx + 1;
      const cells = attemptIds.map((attemptId) => {
        const perAttempt = agg.get(attemptId);
        const stat = perAttempt?.get(table);
        if (!stat || stat.t === 0) return { score: null };
        const score = Math.round((stat.c / stat.t) * 100);
        return { score };
      });
      return { table, cells };
    });

    return res.json({
      ok: true,
      heatmap: { columns, rows },
      ...(debug ? { debug: { attempts: attempts?.length || 0, question_records: qrs?.length || 0, unknownSamples } } : {})
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
