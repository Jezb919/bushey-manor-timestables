// lib/requireAdmin.js
// Ensures the request is from a logged-in TEACHER with role=admin.
// If not admin, it writes the HTTP response and ends it.
// If admin, it returns the parsed teacher session object.

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;

  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function tryParseSession(raw) {
  if (!raw) return null;

  // cookie values may be URI encoded
  const candidates = [];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch (_) {
    candidates.push(raw);
  }
  candidates.push(raw);

  for (const c of candidates) {
    // plain JSON
    try {
      const j = JSON.parse(c);
      if (j && typeof j === "object") return j;
    } catch (_) {}

    // base64 JSON
    try {
      const buf = Buffer.from(c, "base64").toString("utf8");
      const j = JSON.parse(buf);
      if (j && typeof j === "object") return j;
    } catch (_) {}
  }

  return null;
}

export default async function requireAdmin(req, res) {
  try {
    const cookies = parseCookies(req.headers?.cookie || "");
    const raw = cookies["bmtt_teacher"]; // your app uses this cookie name
    const session = tryParseSession(raw);

    const role = session?.role;
    if (role !== "admin") {
      res.status(403).json({
        ok: false,
        error: "Admin only",
        debug: { hasCookie: !!raw, role: role ?? null },
      });
      return null;
    }

    return session;
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: "Failed admin check",
      debug: e?.message || String(e),
    });
    return null;
  }
}
