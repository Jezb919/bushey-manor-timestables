// pages/api/public/classes.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function sortClassLabels(a, b) {
  // Order by year (3..6) then M before B? (or B then M). We'll do M then B.
  const ay = Number(String(a.class_label || "").slice(1)) || 0;
  const by = Number(String(b.class_label || "").slice(1)) || 0;
  if (ay !== by) return ay - by;

  const al = String(a.class_label || "")[0] || "";
  const bl = String(b.class_label || "")[0] || "";
  const order = { M: 0, B: 1 };
  return (order[al] ?? 9) - (order[bl] ?? 9);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Use GET" });
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, class_label, year_group")
    .not("class_label", "is", null);

  if (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to load classes",
      details: error.message,
    });
  }

  const classes = (data || [])
    .filter((c) => c.class_label)
    .sort(sortClassLabels);

  return res.status(200).json({ ok: true, classes });
}
