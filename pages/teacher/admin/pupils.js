import { useEffect, useMemo, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

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

  /* ---------------- LOAD DATA ---------------- */

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
    setPupils(list.filter((s) => s.class_id === selectedClassId));
  }

  useEffect(() => {
    (async () => {
      try {
        await loadClasses();
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (classId) await loadPupils(classId);
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, [classId]);

  /* ---------------- ACTIONS ---------------- */

  async function addPupil() {
    setMsg("");
    setErr("");
    setCredsBox(null);

    if (!firstName.trim() || !lastName.trim()) {
      return setErr("Please enter first name and surname");
    }

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
      if (!j.ok) return setErr(j.error);

      const name = `${j.pupil.first_name} ${j.pupil.last_name}`;

      setMsg(`Added ${name} ✅`);
      setCredsBox({
        title: "New pupil login (copy now)",
        name,
        username: j.credentials.username,
        tempPassword: j.credentials.tempPassword,
      });

      setFirstName("");
      setLastName("");
      await loadPupils(classId);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(student_id, name) {
    setMsg("");
    setErr("");
    setCredsBox(null);

    const r = await fetch("/api/admin/pupils/reset_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id }),
    });

    const j = await r.json();
    if (!j.ok) return setErr(j.error);

    setMsg(`Password reset for ${name} ✅`);
    setCredsBox({
      title: "Reset password (copy now)",
      name,
      username: j.credentials.username,
      tempPassword: j.credentials.tempPassword,
    });

    await loadPupils(classId);
  }

  async function changeUsername(student_id, currentUsername, name) {
    const newUsername = prompt(`New username for ${name}`, currentUsername || "");
    if (!newUsername) return;

    setMsg("");
    setErr("");
    setCredsBox(null);

    const r = await fetch("/api/admin/pupils/change_username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id, new_username: newUsername }),
    });

    const j = await r.json();
    if (!j.ok) return setErr(j.error);

    setMsg(`Username changed → ${j.pupil.username} ✅`);
    await loadPupils(classId);
  }

  const classLabel = useMemo(
    () => classes.find((c) => c.id === classId)?.class_label || "",
    [classes, classId]
  );

  /* ---------------- UI ---------------- */

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ✅ HEADER WITH LOGOUT */}
        <AdminHeader title="Pupils" />

        {err && <div style={errStyle}>{err}</div>}
        {msg && <div style={msgStyle}>{msg}</div>}

        <div style={card}>
          <h3>Add pupil to {classLabel}</h3>

          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={input}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.class_label}</option>
            ))}
          </select>

          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={input}
          />

          <input
            placeholder="Surname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={input}
          />

          <button onClick={addPupil} disabled={saving} style={button}>
            {saving ? "Adding…" : "Add pupil"}
          </button>
        </div>

        {credsBox && (
          <div style={card}>
            <h3>{credsBox.title}</h3>
            <p><b>Pupil:</b> {credsBox.name}</p>
            <p><b>Username:</b> <code>{credsBox.username}</code></p>
            <p><b>Password:</b> <code>{credsBox.tempPassword}</code></p>
          </div>
        )}

        <div style={card}>
          <h3>Pupils in {classLabel}</h3>

          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => {
                const name = `${p.first_name} ${p.last_name}`;
                return (
                  <tr key={p.id}>
                    <td>{name}</td>
                    <td><code>{p.username}</code></td>
                    <td>
                      <button onClick={() => resetPassword(p.id, name)}>Reset password</button>{" "}
                      <button onClick={() => changeUsername(p.id, p.username, name)}>Change username</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const card = { background: "#fff", padding: 16, borderRadius: 12, marginTop: 16 };
const input = { padding: 8, marginRight: 8 };
const button = { padding: 10, fontWeight: 700 };

const errStyle = { color: "red", fontWeight: 700, marginTop: 8 };
const msgStyle = { color: "green", fontWeight: 700, marginTop: 8 };
