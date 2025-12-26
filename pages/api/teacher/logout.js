export default function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  const base = "Max-Age=0; Expires=" + expire + "; SameSite=Lax";

  res.setHeader("Set-Cookie", [
    `bmtt_teacher=; Path=/; ${base}`,
    `bmtt_teacher=; Path=/teacher; ${base}`,
    `bmtt_session=; Path=/; ${base}`,
    `bmtt_session=; Path=/teacher; ${base}`,
  ]);

  return res.json({ ok: true });
}
