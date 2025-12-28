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

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function getAuthFromCookies(req) {
  const cookies = parseCookies(req);
  const raw = cookies.bmtt_teacher || cookies.bmtt_session || "";
  const parsed = safeJsonParse(raw);
  const role = parsed?.role || null;
  const teacherId = parsed?.teacherId || parsed?.teacher_id || null;
  return { role, teacherId };
}

async function supabaseAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function detectStudentTable(supabase) {
  for (const t of ["students", "pupils"]) {
    const { error } = await supabase.from(t).select("id").limit(1);
    if (!error) return t;
  }
  return "students";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const auth = getAuthFromCookies(req);
  if (auth.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: auth });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  const class_label = String(body?.class_label || "").trim();
  if (!class_label) return res.status(400).json({ ok: false, error: "Missing class_label" });

  try {
    const supabase = await supabaseAdmin();
    const table = await detectStudentTable(supabase);

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,class_label")
      .eq("class_label", class_label)
      .single();

    if (clsErr || !cls) {
      return res.status(400).json({ ok: false, error: "Class not found", debug: clsErr?.message || clsErr });
    }

    // Delete pupils for that class (attempts should be cascade or handled elsewhere)
    const { error: delErr } = await supabase
      .from(table)
      .delete()
      .eq("class_id", cls.id);

    if (delErr) {
      return res.status(500).json({ ok: false, error: "Failed to delete pupils", debug: delErr.message, table });
    }

    return res.json({ ok: true, deleted_class: class_label, table_used: table });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
