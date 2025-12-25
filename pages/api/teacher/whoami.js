export default function handler(req, res) {
  const names = Object.keys(req.cookies || {});
  let parsed = null;
  let error = null;

  const raw = req.cookies?.bmtt_teacher;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      error = String(e);
    }
  }

  res.json({
    ok: true,
    cookieNames: names,
    has_bmtt_teacher: !!raw,
    parsedKeys: parsed ? Object.keys(parsed) : null,
    parsedRole: parsed?.role || null,
    parsedTeacherId: parsed?.teacherId || parsed?.teacher_id || null,
    parseError: error,
  });
}
