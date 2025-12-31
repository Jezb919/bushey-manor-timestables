// pages/api/student/session.js

function parseCookies(cookieHeader) {
  const out = {};
  const raw = cookieHeader || "";
  raw.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req.headers.cookie || "");
    const raw = cookies["bmtt_student"];

    if (!raw) {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    let session = null;
    try {
      session = JSON.parse(raw);
    } catch {
      return res.status(200).json({ ok: true, signedIn: false });
    }

    return res.status(200).json({
      ok: true,
      signedIn: true,
      session,
    });
  } catch (e) {
    return res.status(200).json({
      ok: true,
      signedIn: false,
      debug: String(e && e.stack ? e.stack : e),
    });
  }
}
