import { useEffect, useState } from "react";

export default function AdminPupilsPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [createdCreds, setCreatedCreds] = useState(null);

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
    setCreatedCreds(null);

    if (!firstName.trim()) return setErr("Please type the pupil's first name");
    if (!lastName.trim()) return setErr("Please type the pupil's surname");
    if (!classId) return setErr("Please choose a class");

    setSaving(true);
    try {
      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          class_id: classId,
        }),
      });

      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Failed to add pupil");

      setMsg(`Added ${j.pupil.first_name} ${j.pupil.last_name} to ${j.pupil.class_label} ✅`);
      setCreatedCreds(j.credentials);

      setFirstName("");
      setLastName("");
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

        <div style={card}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={label}>
              First name (required)
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
            </label>

            <label style={label}>
              Surname (required)
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
            </label>
          </div>

          <button onClick={addPupil} disabled={saving} style={button(saving)}>
            {saving ? "Adding..." : "Add pupil"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            After creating a pupil, you’ll see their username + a temporary password (copy it straight away).
          </div>
        </div>

        {createdCreds ? (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Generated login details</div>

            <div style={{ display: "grid", gap: 8 }}>
              <div><b>Username:</b> <code>{createdCreds.username}</code></div>
              <div><b>Temporary password:</b> <code>{createdCreds.tempPassword}</code></div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              You can’t “view” old passwords later (they aren’t stored readable). If needed, you reset it to generate a new one.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const card = {
  padding: 16,
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
  display: "grid",
  gap: 12,
};

const label = { display: "grid", gap: 6, fontWeight: 800 };

const input = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
};

const button = (saving) => ({
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.12)",
  background: saving ? "rgba(0,0,0,0.06)" : "#111827",
  color: saving ? "#111827" : "#fff",
  fontWeight: 900,
  cursor: saving ? "not-allowed" : "pointer",
});
