export default function handler(req, res) {
  try {
    const raw = req.cookies?.bmtt_student;
    if (!raw) return res.status(401).json({ ok: false, error: "Not logged in" });

    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed?.student_id) return res.status(401).json({ ok: false, error: "Bad session" });

    return res.json({ ok: true, student: parsed });
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Bad session", debug: String(e) });
  }
}
