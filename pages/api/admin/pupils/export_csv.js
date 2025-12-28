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

  if (!url || !serviceKey) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  const session = readTeacherCookie(req);
  if (!session || session.role !== "admin") {
    return res.status(403).send("Admins only");
  }

  const class_label = String(req.query.class_label || "").trim();
  if (!class_label) return res.status(400).send("Missing class_label");

  try {
    const supabase = supabaseAdmin();

    // IMPORTANT: this assumes pupils table is "students" and PIN stored in a column called "pin"
    // If yours differs, tell me the column name and I'll adjust.
    const { data, error } = await supabase
      .from("students")
      .select("first_name,last_name,username,pin,class_id,classes(class_label)")
      .eq("classes.class_label", class_label);

    if (error) throw new Error(error.message);

    // sort nicely by last name then first name
    const rows = (data || []).slice().sort((a, b) => {
      const al = (a.last_name || "").toLowerCase();
      const bl = (b.last_name || "").toLowerCase();
      if (al !== bl) return al.localeCompare(bl);
      const af = (a.first_name || "").toLowerCase();
      const bf = (b.first_name || "").toLowerCase();
      return af.localeCompare(bf);
    });

    const header = ["class_label", "first_name", "last_name", "username", "pin"];
    const lines = [header.join(",")];

    for (const p of rows) {
      const line = [
        class_label,
        (p.first_name || "").replaceAll('"', '""'),
        (p.last_name || "").replaceAll('"', '""'),
        (p.username || "").replaceAll('"', '""'),
        (p.pin || "").toString().replaceAll('"', '""'),
      ]
        .map((v) => `"${v}"`)
        .join(",");
      lines.push(line);
    }

    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pupils_${class_label}_usernames_pins.csv"`
    );
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
}
