export default function handler(req, res) {
  // Clear both possible auth cookies
  res.setHeader("Set-Cookie", [
    "bmtt_teacher=; Path=/; Max-Age=0; SameSite=Lax",
    "bmtt_session=; Path=/; Max-Age=0; SameSite=Lax",
  ]);

  return res.json({ ok: true });
}
