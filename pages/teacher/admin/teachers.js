import { useEffect, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Bad response from server", debug: text?.slice(0, 120) || "" };
  }
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");

  const [credsBox, setCredsBox] = useState(null);

  async function loadTeachers() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/teachers/list");
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to load teachers");
      setTeachers(j.teachers || []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeachers();
  }, []);

  async function setRoleFor(teacher_id, newRole, emailAddr) {
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/teachers/set_role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id, role: newRole }),
      });
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to update role");
      setMsg(`Updated ${emailAddr} → ${newRole} ✅`);
      await loadTeachers();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function createTeacher() {
    setErr("");
    setMsg("");
    setCredsBox(null);

    if (!email.trim()) return setErr("Enter an email");
    try {
      const r = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, role }),
      });
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to create teacher");

      setMsg(`Created ${j.teacher.email} ✅`);
      setCredsBox({
        title: "New teacher login (copy now)",
        email: j.credentials.email,
        tempPassword: j.credentials.tempPassword,
      });

      setFullName("");
      setEmail("");
      setRole("teacher");
      await loadTeachers();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function resetPassword(teacher_id, emailAddr) {
    setErr("");
    setMsg("");
    setCredsBox(null);

    try {
      const r = await fetch("/api/admin/teachers/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id }),
      });
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to reset password");

      setMsg(`Password reset for ${emailAddr} ✅`);
      setCredsBox({
        title: "Reset password (copy now)",
        email: j.credentials.email,
        tempPassword: j.credentials.tempPassword,
      });
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function deleteTeacher(teacher_id, emailAddr) {
    const ok = confirm(`Delete ${emailAddr}?`);
    if (!ok) return;

    setErr("");
    setMsg("");
    setCredsBox(null);

    try {
      const r = await fetch("/api/admin/teachers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id }),
      });
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to delete teacher");

      setMsg(`Deleted ${emailAddr} ✅`);
      await loadTeachers();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <AdminHeader title="Teachers" />

        {err && <div style={errBox}>{err}</div>}
        {msg && <div style={okBox}>{msg}</div>}

        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Add a teacher</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={input}
              placeholder="Full name (optional)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              style={input}
              placeholder="Email (this is the username)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select style={input} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
            <button style={btnPrimary} onClick={createTeacher}>Create</button>
          </div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
            Password is generated automatically and shown once. You can reset it later.
          </div>
        </div>

        {credsBox && (
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{credsBox.title}</div>
            <div><b>Email:</b> <code>{credsBox.email}</code></div>
            <div><b>Temporary password:</b> <code>{credsBox.tempPassword}</code></div>
          </div>
        )}

        <div style={card}>
          {loading ? (
            <div style={{ padding: 10 }}>Loading…</div>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td style={tdStrong}>{t.full_name || "—"}</td>
                    <td style={tdMono}>{t.email}</td>
                    <td style={tdRole}>{t.role}</td>
                    <td style={tdRight}>
                      {t.role === "admin" ? (
                        <button style={btn} onClick={() => setRoleFor(t.id, "teacher", t.email)}>
                          Make teacher
                        </button>
                      ) : (
                        <button style={btn} onClick={() => setRoleFor(t.id, "admin", t.email)}>
                          Make admin
                        </button>
                      )}{" "}
                      <button style={btn} onClick={() => resetPassword(t.id, t.email)}>
                        Reset password
                      </button>{" "}
                      <button style={btnDanger} onClick={() => deleteTeacher(t.id, t.email)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {!teachers.length && (
                  <tr>
                    <td style={td} colSpan={4}>No teachers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ opacity: 0.7, marginTop: 12, fontSize: 12 }}>
          Teacher login page: <code>/teacher/login</code> (username is email)
        </div>
      </div>
    </div>
  );
}

/* styles */
const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
  marginTop: 16,
};

const input = { padding: 10, borderRadius: 10, border: "1px solid #ddd", minWidth: 220 };
const btn = { padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, cursor: "pointer" };
const btnPrimary = { ...btn, background: "#111827", color: "#fff", border: "1px solid #111827" };
const btnDanger = { ...btn, border: "1px solid #ef4444", color: "#b91c1c" };

const errBox = { color: "#b91c1c", fontWeight: 900, marginTop: 10 };
const okBox = { color: "#166534", fontWeight: 900, marginTop: 10 };

const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, opacity: 0.7, borderBottom: "1px solid rgba(0,0,0,0.1)" };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
const tdStrong = { ...td, fontWeight: 900 };
const tdMono = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const tdRole = { ...td, fontWeight: 900, textTransform: "lowercase" };
const tdRight = { ...td, textAlign: "right" };
