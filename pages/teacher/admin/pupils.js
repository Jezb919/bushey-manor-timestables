import { useEffect, useMemo, useState } from "react";

export default function AdminPupilsPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [pupils, setPupils] = useState([]);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [credsBox, setCredsBox] = useState(null);

  async function loadClasses() {
    const r = await fetch("/api/teacher/classes");
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Failed to load classes");
    setClasses(j.classes || []);
    if (j.classes?.length) setClassId((prev) => prev || j.classes[0].id);
  }

  async function loadPupils(selectedClassId) {
    const r = await fetch("/api/teacher/students");
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Failed to load pupils");

    const list = j.students || [];
    const cl = classes.find((c) => c.id === selectedClassId)?.class_label;

    // Prefer class_id match; fallback to class_label match
    const filtered = list.filter(
      (s) => s.class_id === selectedClassId || (cl && s.class_label === cl)
    );
    setPupils(filtered);
  }

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        await loadClasses();
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!classId) return;
        setErr("");
        await loadPupils(classId);
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, classes.length]);

  async function addPupil() {
    setMsg("");
    setErr("");
    setCredsBox(null);

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

      const fullName = `${j.pupil.first_name} ${j.pupil.last_name}`.trim();
      setMsg(`Added ${fullName} ✅`);

      setCredsBox({
        name: fullName,
        username: j.credentials?.username || j.pupil.username || "(no username returned)",
        tempPassword: j.credentials?.tempPassword || "(no temp password returned)",
      });

      setFirstName("");
      setLastName("");

      await loadPupils(classId);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(student_id, name) {
    setMsg("");
    setErr("");
    setCredsBox(null);

    try {
      const r = await fetch("/api/admin/pupils/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id }),
      });

      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Failed to reset password");

      setMsg(`Password reset for ${name} ✅`);
      setCredsBox({
        name,
        username: j.credentials?.username || j.pupil?.username || "(unknown)",
        tempPassword: j.credentials?.tempPassword || "(not returned)",
      });

      await loadPupils(classId);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function changeUsername(student_id, currentUsername, name) {
    const prefill = currentUsername || "";
    const newUsername = prompt(`New username for ${name}`, prefill);
    if (!newUsername) return;

    setMsg("");
    setErr("");
    setCredsBox(null);

    try {
      const r = await fetch("/api/admin/pupils/change_username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id, new_username: newUsername }),
      });
      const j = await r.json();
      if (!j.ok) return setErr(j.error || "Failed to change username");

      setMsg(`Username changed for ${name} → ${j.pupil.username} ✅`);
      await loadPupils(classId);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  const classLabel = useMemo(() => classes.find((c) => c.id === classId)?.class_label || "", [classes, classId]);

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Pupils</h1>
        <div style={{ opacity: 0.75, marginBottom: 12 }}>Create pupils, generate logins, reset passwords.</div>

        {err ? <div style={{ color: "#b91c1c", fontWeight: 800, marginBottom: 10 }}>{err}</div> : null}
        {msg ? <div style={{ color: "#166534", fontWeight: 800, marginBottom: 10 }}>{msg}</div> : null}

        <div style={card}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
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
              First name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
            </label>

            <label style={label}>
              Surname
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
            </label>

            <button onClick={addPupil} disabled={saving} style={button(saving)}>
              {saving ? "Adding..." : "Add pupil"}
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Username generated (unique). Password generated and shown once (copy it).
          </div>
        </div>

        {credsBox ? (
          <div style={{ ...card, marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Login details (copy now)</div>
            <div style={{ display: "grid", gap: 6 }}>
              <div><b>Pupil:</b> {credsBox.name}</div>
              <div><b>Username:</b> <code>{credsBox.username}</code></div>
              <div><b>Temporary password:</b> <code>{credsBox.tempPassword}</code></div>
            </div>
          </div>
        ) : null}

        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            Pupils in {classLabel || "selected class"} ({pupils.length})
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Username</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => {
                  const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Pupil";
                  return (
                    <tr key={p.id}>
                      <td style={tdStrong}>{name}</td>
                      <td style={td}><code>{p.username || "— (not set yet)"}</code></td>
                      <td style={td}>
                        <button style={smallBtn} onClick={() => resetPassword(p.id, name)}>
                          Reset password
                        </button>{" "}
                        <button style={smallBtn} onClick={() => changeUsername(p.id, p.username, name)}>
                          Change username
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!pupils.length ? (
                  <tr>
                    <td style={td} colSpan={3}>No pupils found for this class yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
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
const input = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" };

const button = (saving) => ({
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.12)",
  background: saving ? "rgba(0,0,0,0.06)" : "#111827",
  color: saving ? "#111827" : "#fff",
  fontWeight: 900,
  cursor: saving ? "not-allowed" : "pointer",
});

const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, opacity: 0.75, borderBottom: "1px solid rgba(0,0,0,0.08)" };
const td = { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
const tdStrong = { ...td, fontWeight: 900 };

const smallBtn = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};
