// pages/api/teacher/logout.js
function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; Max-Age=0; SameSite=Lax`);
}

export default async function handler(req, res) {
  clearCookie(res, "bmtt_teacher");
  return res.status(200).json({ ok: true });
}
