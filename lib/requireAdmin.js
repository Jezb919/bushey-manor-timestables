// lib/requireAdmin.js

function parseCookies(cookieHeader = "") {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

// Tries multiple formats because your bmtt_teacher cookie may be JSON or base64 JSON.
function parseBmttTeacher(raw) {
  if (!raw) return null;

  // 1) Plain JSON
  try {
    return JSON.parse(raw);
  } catch {}

  // 2) base64 JSON
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {}

  // 3) URI encoded JSON (sometimes happens)
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {}

  return null;
}

export default function requireAdmin(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionRaw = cookies.bmtt_teacher || cookies.bmtt_session;

  const session = parseBmttTeacher(sessionRaw);

  if (!session || !session.role || !session.teacherId) {
    res.status(401).json({ ok: false, error: "Not logged in" });
    return null;
  }

  if (session.role !== "admin") {
    res.status(403).json({
      ok: false,
      error: "Admins only",
      debug: { role: session.role, teacher_id: session.teacherId },
    });
    return null;
  }

  return session; // { teacherId, role, email, full_name, ... }
}
