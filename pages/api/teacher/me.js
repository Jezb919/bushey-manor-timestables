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

export default function handler(req, res) {
  try {
    const cookies = parseCookies(req);

    // ✅ Your app is now using bmtt_teacher as the main cookie
    const raw = cookies.bmtt_teacher || null;
    const parsed = raw ? safeJsonParse(raw) : null;

    if (!parsed) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
        debug: {
          cookieNames: Object.keys(cookies),
          has_bmtt_teacher: !!cookies.bmtt_teacher,
          note: "bmtt_teacher exists but could not be parsed as JSON",
        },
      });
    }

    // Accept either teacherId or teacher_id
    const teacherId = parsed.teacherId || parsed.teacher_id || null;
    const role = parsed.role || null;
    const email = parsed.email || null;
    const full_name = parsed.full_name || "";

    if (!teacherId || !role || !email) {
      return res.status(401).json({
        ok: false,
        error: "Not logged in",
        debug: {
          parsedKeys: Object.keys(parsed || {}),
          note: "bmtt_teacher parsed but missing required fields",
        },
      });
    }

    // ✅ Return exactly what your pages expect: { ok: true, user: {...} }
    return res.json({
      ok: true,
      user: {
        id: teacherId,
        teacher_id: teacherId,
        role,
        email,
        full_name,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error", debug: String(e) });
  }
}
