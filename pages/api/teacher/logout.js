export default function handler(req, res) {
  // Allow both GET and POST so it's easy to test in browser
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // Clear cookies with BOTH common paths (Path=/ and Path=/teacher)
  // This fixes the “incognito works, normal browser doesn’t” issue.
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
