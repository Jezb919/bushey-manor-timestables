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
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
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
  const tryTables = ["students", "pupils"];
  for (const t of tryTables) {
    const { error } = await supabase.from(t).select("id").limit(1);
    if (!error) return t;
  }
  return "students";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Use GET" });

  const auth = getAuthFromCookies(req);
  if (auth.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admins only", debug: auth });
  }

  const class_label = String(req.query.class_label || "").trim();

  try {
    const supabase = await supabaseAdmin();
    const table = await detectStudentTable(supabase);

    let classRow = null;
    if (class_label) {
      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id,class_label")
        .eq("class_label", class_label)
        .single();

      if (clsErr || !cls) {
        return res.status(400).json({ ok: false, error: "Class not found", debug: clsErr?.message || clsErr });
      }
      classRow = cls;
    }

    let q = supabase
      .from(table)
      .select("id,first_name,last_name,username,class_id")
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true });

    if (classRow?.id) q = q.eq("class_id", classRow.id);

    const { data: pupils, error } = await q;
    if (error) {
      return res.status(500).json({ ok: false, error: "Failed to load pupils", debug: error.message, table });
    }

    return res.json({
      ok: true,
      table_used: table,
      class: classRow ? { id: classRow.id, class_label: classRow.class_label } : null,
      pupils: pupils || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e?.message || e) });
  }
}
