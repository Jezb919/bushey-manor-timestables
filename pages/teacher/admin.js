// pages/teacher/admin.js
import { useEffect, useMemo, useState } from "react";

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);

  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [assignedClassIds, setAssignedClassIds] = useState([]);

  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newPassword, setNewPassword] = useState("");

  const selectedTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || null,
    [teachers, selectedTeacherId]
  );

  async function loadMe() {
    const r = await fetch("/api/teacher/me");
    const j = await r.json();
    setMe(j);
    if (j?.classes) setClasses(j.classes);
  }

  async function loadTeachers() {
    const r = await fetch("/api/teacher/admin/teachers");
    const j = await r.json();
    if (j.ok) setTeachers(j.teachers || []);
    else alert(j.error || "Failed to load teachers");
  }

  async function loadAssignments(teacherId) {
    if (!teacherId) return;
    const r = await fetch(`/api/teacher/admin/assignments?teacher_id=${teacherId}`);
    const j = await r.json();
    if (j.ok) setAssignedClassIds(j.classIds || []);
    else alert(j.error || "Failed to load assignments");
  }

  useEffect(() => {
    loadMe();
    loadTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacherId) loadAssignments(selectedTeacherId);
  }, [selectedTeacherId]);

  async function createTeacher(e) {
    e.preventDefault();
    const r = await fetch("/api/teacher/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        full_name: newFullName,
        role: newRole,
        password: newPassword,
      }),
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error || "Create failed");

    setNewEmail("");
    setNewFullName("");
    setNewPassword("");
    await loadTeachers();
    alert("Teacher created ✅");
  }

  function toggleClass(classId) {
    setAssignedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((x) => x !== classId) : [...prev, classId]
    );
  }

  async function saveAssignments() {
    if (!selectedTeacherId) return alert("Select a teacher first");
    const r = await fetch("/api/teacher/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: selectedTeacherId, classIds: assignedClassIds }),
    });
    const j = await r.json();
    if (!j.ok) return alert(j.error || "Save failed");
    alert("Assignments saved ✅");
  }

  async function resetPassword() {
    if (!selectedTeacherId) return alert("Select a teacher first");
    const pw = prompt("Enter a NEW password for this teacher:");
    if (!pw) return;

    const r = await fetch("/api/teacher/admin/reset_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: selectedTeacherId, password: pw }),
    });

    const j = await r.json();
    if (!j.ok) return alert(j.error || "Reset failed");
    alert("Password reset ✅");
  }

  // Guard
  if (!me) return <div style={wrap}><Card>Loading…</Card></div>;
  if (!me.loggedIn) return <div style={wrap}><Card>Please log in first.</Card></div>;
  if (me.teacher?.role !== "admin")
    return <div style={wrap}><Card>Admin only.</Card></div>;

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 1100 }}>
        <h1 style={h1}>Admin: Teachers & Classes</h1>
        <p style={sub}>
          Create teachers, assign classes, and reset passwords.
        </p>

        <div style={grid}>
          <Card>
            <h2 style={h2}>Create teacher</h2>
            <form onSubmit={createTeacher}>
              <Field label="Email">
                <input style={input} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </Field>

              <Field label="Full name">
                <input style={input} value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required />
              </Field>

              <Field label="Role">
                <select style={input} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                </select>
              </Field>

              <Field label="Password">
                <input
                  style={input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  type="password"
                />
              </Field>

              <button style={btnPrimary} type="submit">
                Create
              </button>
            </form>
          </Card>

          <Card>
            <h2 style={h2}>Assign classes</h2>

            <Field label="Select teacher">
              <select
                style={input}
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
              >
                <option value="">— choose —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.email}) [{t.role}]
                  </option>
                ))}
              </select>
            </Field>

            {selectedTeacher && (
              <div style={{ marginTop: 10, marginBottom: 10, fontSize: 14, color: "#475569" }}>
                Editing: <strong>{selectedTeacher.full_name}</strong>
              </div>
            )}

            <div style={classBox}>
              {classes.map((c) => (
                <label key={c.id} style={classChip(assignedClassIds.includes(c.id))}>
                  <input
                    type="checkbox"
                    checked={assignedClassIds.includes(c.id)}
                    onChange={() => toggleClass(c.id)}
                    style={{ marginRight: 8 }}
                  />
                  {c.class_label} (Y{c.year_group})
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={btnPrimary} onClick={saveAssignments}>
                Save assignments
              </button>
              <button style={btnGhost} onClick={resetPassword}>
                Reset password
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div style={card}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label}>{label}</div>
      {children}
    </div>
  );
}

/* ---------- Styles (white, clean) ---------- */

const wrap = {
  minHeight: "100vh",
  background: "#f8fafc",
  display: "flex",
  justifyContent: "center",
  padding: "24px",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
};

const h1 = { fontSize: 28, margin: "0 0 6px", color: "#0f172a" };
const sub = { margin: "0 0 18px", color: "#475569" };
const h2 = { fontSize: 18, margin: "0 0 12px", color: "#0f172a" };

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const card = {
  background: "white",
  borderRadius: 14,
  padding: 16,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const label = { fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 };

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};

const classBox = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  padding: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc",
  maxHeight: 280,
  overflow: "auto",
};

const classChip = (on) => ({
  display: "flex",
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${on ? "#93c5fd" : "#e2e8f0"}`,
  background: on ? "#eff6ff" : "white",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
});
