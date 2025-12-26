import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSession(req) {
  const raw = req.cookies?.bmtt_teacher;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      teacher_id: p.teacherId || p.teacher_id || null,
      role: p.role || null,
    };
  } catch {
    return null;
  }
}

function pctFromAttempt(a) {
  const direct =
    a.score ??
    a.score_percent ??
    a.percentage ??
    a.percent ??
    a.score_pct ??
    null;

  if (direct !== null && direct !== undefined) {
    const n = Number(direct);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  const correct = a.correct ?? a.num_correct ?? null;
  const total = a.total ?? a.num_questions ?? a.question_count ?? a.total_questions ?? null;

  if (correct !== null && total) {
    const n = Math.round((Number(correct) / Number(total)) * 100);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

export default async function handler(req, res) {
  try {
    const session = getSession(req);
    if (!session?.teacher_id) return res.status(401).json({ ok: false, error: "Not logged in" });

    // 1) Which classes can this user see?
    let classes = [];
    if (session.role === "admin") {
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_label, year_group")
        .order("class_label", { ascending: true });

      if (error) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: error.message });
      classes = data || [];
    } else {
      const { data, error } = await supabase
        .from("teacher_classes")
        .select("class_id, classes:class_id(id, class_label, year_group)")
        .eq("teacher_id", session.teacher_id);

      if (error) return res.status(500).json({ ok: false, error: "Failed to load classes", debug: error.message });

      classes = (data || [])
        .map((r) => r.classes)
        .filter(Boolean)
        .sort((a, b) => String(a.class_label).localeCompare(String(b.class_label)));
    }

    if (!classes.length) return res.json({ ok: true, classes: [], selected: "", pupils: [] });

    const selectedLabel = (req.query.class_label || classes[0].class_label || "").toString();
    const selected = classes.find((c) => c.class_label === selectedLabel) || classes[0];

    // 2) Load pupils in that class
    // ✅ students table DOES NOT have surname yet, so we only use first_name
    const { data: pupils, error: pErr } = await supabase
      .from("students")
      .select("id, first_name, class_label")
      .eq("class_label", selected.class_label)
      .order("first_name", { ascending: true });

    if (pErr) return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: pErr.message });

    const pupilList = pupils || [];
    if (!pupilList.length) {
      return res.json({ ok: true, classes, selected: selected.class_label, pupils: [] });
    }

    // 3) Recent attempts for these pupils
    const ids = pupilList.map((s) => s.id);

    const { data: attempts, error: aErr } = await supabase
      .from("attempts")
      .select("*")
      .in("student_id", ids)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (aErr) return res.status(500).json({ ok: false, error: "Failed to load attempts", debug: aErr.message });

    const byStudent = {};
    for (const a of attempts || []) {
      const sid = a.student_id;
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(a);
    }

    const out = pupilList.map((s) => {
      const list = byStudent[s.id] || [];
      const scores = list.map(pctFromAttempt).filter((x) => x !== null);

      const last5 = scores.slice(0, 5);
      const last10 = scores.slice(0, 10);

      const latest = last5.length ? last5[0] : null;
      const avg10 = last10.length
        ? Math.round(last10.reduce((a, b) => a + b, 0) / last10.length)
        : null;

      return {
        id: s.id,
        name: s.first_name || "",
        class_label: s.class_label,
        latest,
        last5,
        avg10,
        attempts_count: list.length,
      };
    });

    return res.json({ ok: true, classes, selected: selected.class_label, pupils: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
