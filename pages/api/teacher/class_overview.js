// pages/api/teacher/class_overview.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getTeacherSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return { ok: false, error: "Not logged in" };

  const parsed = safeJsonParse(raw);
  if (!parsed) return { ok: false, error: "Invalid session cookie" };

  const role = parsed.role || parsed.parsedRole || parsed.teacher_role;
  const teacher_id =
    parsed.teacher_id || parsed.teacherId || parsed.parsedTeacherId;

  if (!role || !teacher_id) return { ok: false, error: "Invalid session data" };

  return { ok: true, role, teacher_id };
}

async function getAllClassLabels() {
  // Your schema uses classes.class_label (NOT classes.label)
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id,class_label")
    .order("class_label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).filter((c) => c.class_label);
}

async function getTeacherAllowedClasses(teacher_id) {
  // teacher_classes should link teacher_id -> class_id
  // Then we join to classes to get class_label
  const { data, error } = await supabaseAdmin
    .from("teacher_classes")
    .select("class_id, classes:class_id ( id, class_label )")
    .eq("teacher_id", teacher_id);

  if (error) throw new Error(error.message);

  const classes = (data || [])
    .map((row) => row.classes)
    .filter(Boolean)
    .filter((c) => c.class_label);

  // de-dupe
  const map = new Map();
  for (const c of classes) map.set(c.class_label, c);
  return Array.from(map.values()).sort((a, b) =>
    a.class_label.localeCompare(b.class_label)
  );
}

async function loadPupilsForClass(class_id) {
  // students table is your pupil table
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, username")
    .eq("class_id", class_id)
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);

  const pupils = (data || []).map((p) => ({
    pupil_id: p.id,
    pupil_name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "(no name)",
    username: p.username || "",
  }));

  return pupils;
}

async function loadAttemptsForPupils(pupilIds) {
  if (!pupilIds.length) return [];

  // IMPORTANT: your attempts table stores score as "score" (NOT score_percent)
  const { data, error } = await supabaseAdmin
    .from("attempts")
    .select("id, student_id, created_at, score")
    .in("student_id", pupilIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export default async function handler(req, res) {
  const debug = req.query.debug === "1";

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const sess = getTeacherSession(req);
    if (!sess.ok) return res.status(401).json({ ok: false, error: sess.error });

    const isAdmin = sess.role === "admin";

    // 1) Allowed classes
    let allowed = [];
    if (isAdmin) {
      allowed = await getAllClassLabels();
    } else {
      allowed = await getTeacherAllowedClasses(sess.teacher_id);
    }

    const allowed_labels = allowed.map((c) => c.class_label);

    if (!allowed_labels.length) {
      return res.json({
        ok: true,
        allowed_classes: [],
        class: null,
        rows: [],
        debug: debug ? { role: sess.role, teacher_id: sess.teacher_id } : undefined,
      });
    }

    // 2) Choose class_label (requested, else first allowed)
    const requested = (req.query.class_label || "").toString().trim();
    const class_label = requested && allowed_labels.includes(requested)
      ? requested
      : allowed_labels[0];

    const selected = allowed.find((c) => c.class_label === class_label) || allowed[0];

    // 3) Pupils + attempts summary
    const pupils = await loadPupilsForClass(selected.id);
    const pupilIds = pupils.map((p) => p.pupil_id);

    const attempts = await loadAttemptsForPupils(pupilIds);

    // group attempts by pupil
    const byPupil = new Map();
    for (const a of attempts) {
      const arr = byPupil.get(a.student_id) || [];
      arr.push(a);
      byPupil.set(a.student_id, arr);
    }

    const rows = pupils.map((p) => {
      const arr = byPupil.get(p.pupil_id) || [];
      const latest = arr[0]?.score ?? null;
      const recent = arr.slice(0, 3).map((x) => x.score ?? null);
      return {
        ...p,
        latest_score: typeof latest === "number" ? latest : null,
        attempts: arr.length,
        recent,
      };
    });

    return res.json({
      ok: true,
      allowed_classes: allowed_labels,
      class: { id: selected.id, class_label },
      rows,
      debug: debug
        ? { teacher: { role: sess.role, teacher_id: sess.teacher_id }, pupils: pupils.length, attempts: attempts.length }
        : undefined,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Failed to load class overview",
      debug: debug ? String(e?.message || e) : undefined,
    });
  }
}
