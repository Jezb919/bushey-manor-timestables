import { useEffect, useState } from "react";

export default function AdminPupilsPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [studentId, setStudentId] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Load class list
  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const r = await fetch("/api/teacher/classes");
        const j = await r.json();
        if (!j.ok) return setErr(j.error || "Failed to load classes");
        setClasses(j.classes || []);
        if (j.classes?.length) setClassId(j.classes[0].id);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, []);

  async function addPupil() {
    setMsg("");
    setErr("");

    if (!firstName.trim()) return setErr("Please type the pupil's first name");
    if (!classId) return setErr("Please choose a class");

    setSaving(true);
    try {
      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          username: username.trim() || null,
          student_id: studentId.trim() || null,
          class_id: classId,
        }),
      });

      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Failed to add pupil");

      setMsg(`Added ${j.pupil.first_name} to ${j.pupil.class_label} ✅`);
      setFirstName("");
      setUsername("");
      setStudentId("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Add a Pupil</h1>

        {err ? <div style={{ color: "#b91c1c", fontWeight: 800, marginBottom: 10 }}>{err}</div> : null}
        {msg ? <div style={{ color: "#166534", fontWeight: 800, marginBottom: 10 }}>{msg}</div> : null}

        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            display: "grid",
            gap: 12,
          }}
        >
          <label style={label}>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)} style={input}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_label}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            Pupil first name (required)
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
          </label>

          <label style={label}>
            Username (optional)
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={input} />
          </label>

          <label style={label}>
            Pupil code / student_id (optional)
            <input value={studentId} onChange={(e) => setStudentId(e.target.value)} style={input} />
          </label>

          <button
            onClick={addPupil}
            disabled={saving}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              background: saving ? "rgba(0,0,0,0.06)" : "#111827",
              color: saving ? "#111827" : "#fff",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Adding..." : "Add pupil"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Note: only admins can add pupils (keeps it safe).
          </div>
        </div>
      </div>
    </div>
  );
}

const label = { display: "grid", gap: 6, fontWeight: 800 };
const input = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
};
