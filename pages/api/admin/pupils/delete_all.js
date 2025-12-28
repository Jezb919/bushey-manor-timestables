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

function readTeacherCookie(req) {
  const cookies = parseCookies(req);
  const raw = cookies.bmtt_teacher || cookies.bmtt_session;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const session = readTeacherCookie(req);
  if (!session || session.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only" });
  }

  try {
    const { class_label } = req.body || {};
    const label = String(class_label || "").trim();
    if (!label) return res.status(400).json({ ok: false, error: "Missing class_label" });

    const supabase = supabaseAdmin();

    // Find class id
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,class_label")
      .eq("class_label", label)
      .maybeSingle();

    if (clsErr) throw new Error(clsErr.message);
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

    // Find pupils in this class
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", cls.id);

    if (sErr) throw new Error(sErr.message);

    const ids = (students || []).map((s) => s.id);
    if (ids.length === 0) return res.status(200).json({ ok: true, deleted: 0 });

    // Delete attempts first (FK points to students)
    const { error: aErr } = await supabase.from("attempts").delete().in("student_id", ids);
    if (aErr) throw new Error(aErr.message);

    // If you have a question_records table linked to attempts, you might also delete it here.
    // (Only if it exists in your schema; otherwise leave it alone.)
    // Example if your schema is question_records.student_id:
    // await supabase.from("question_records").delete().in("student_id", ids);

    // Delete pupils
    const { error: dErr } = await supabase.from("students").delete().in("id", ids);
    if (dErr) throw new Error(dErr.message);

    return res.status(200).json({ ok: true, deleted: ids.length, class_label: label });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to delete pupils", debug: String(e.message || e) });
  }
}
