// pages/api/classes.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use GET" });
    }

    const { data, error } = await supabase
      .from("classes")
      .select("class_label, year_group")
      .not("class_label", "is", null)
      .order("year_group", { ascending: true })
      .order("class_label", { ascending: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to load classes",
        details: error.message,
      });
    }

    return res.status(200).json({ ok: true, classes: data || [] });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
}
