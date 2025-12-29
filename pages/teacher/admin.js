// pages/teacher/admin.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const ALL_CLASSES = ["B3","B4","B5","B6","M3","M4","M5","M6"];

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok:false, error:"Bad JSON", debug:text }; }
}

export default function ManageTeachersPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Add teacher form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newClass, setNewClass] = useState("");

  const canSee = useMemo(() => me?.role === "admin", [me]);

  async function load() {
    setMsg("");
    setLoading(true);

    const who = await fetch("/api/teacher/whoami?debug=1");
    const whoJson = await safeJson(who);
    if (!whoJson.ok) {
      setLoading(false);
      setMsg(whoJson.error || "Not logged in");
      return;
    }
    setMe({
      role: whoJson.parsedRole || whoJson.role,
      email: whoJson.email || whoJson.parsedEmail,
      full_name: whoJson.full_name || whoJson.parsedFullName,
    });

    const res = await fetch("/api/admin/teachers/list");
    const j = await safeJson(res);
    if (!j.ok) {
      setLoading(false);
      setMsg(j.error || "Failed to load teachers");
      return;
    }
    setRows(j.teachers || j.rows || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createTeacher(e) {
    e.preventDefault();
    setMsg("");

    const body = {
      full_name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      class_label: newClass || "",
    };

    const res = await fetch("/api/admin/teachers/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await safeJson(res);

    if (!j.ok) {
      setMsg(j.error + (j.debug ? ` (${j.debug})` : ""));
      return;
    }

    setMsg("Teacher created ✅ Now click “Send setup link” for them.");
    setNewName("");
    setNewEmail("");
    setNewRole("teacher");
    setNewClass("");
    await load();
  }

  async function setRole(teacher_id, role) {
    setMsg("");
    const res = await fetch("/api/admin/teachers/set_role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id, role }),
    });
    const j = await safeJson(res);
    if (!j.ok) return setMsg(j.error + (j.debug ? ` (${j.debug})` : ""));
    await load();
  }

  async function resetPassword(teacher_id) {
    setMsg("");
    const res = await fetch("/api/admin/teachers/reset_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id }),
    });
    const j = await safeJson(res);
    if (!j.ok) return setMsg(j.error + (j.debug ? ` (${j.debug})` : ""));
    setMsg("Password reset ✅");
  }

  async function sendSetupLink(teacher_id) {
    setMsg("");
    const res = await fetch("/api/admin/teachers/send_setup_link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id }),
    });
    const j = await safeJson(res);
    if (!j.ok) return setMsg(j.error + (j.debug ? ` (${j.debug})` : ""));
    // Many versions return {link}; show it so you can copy
    setMsg(j.link ? `Setup link (copy): ${j.link}` : "Setup link sent/created ✅");
  }

  async function saveClass(teacher_id, class_label) {
    setMsg("");
    const res = await fetch("/api/admin/teachers/set_class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id, class_label: class_label || "" }),
    });
    const j = await safeJson(res);
    if (!j.ok) return setMsg(j.error + (j.debug ? ` (${j.debug})` : ""));
    setMsg("Class saved ✅");
    await load();
  }

  if (!me && loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 48, marginBottom: 6 }}>Manage Teachers</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ opacity: 0.8 }}>
          Logged in as <b>{me?.email || "unknown"}</b> ({me?.role || "unknown"})
        </div>
        <Link href="/teacher/dashboard">← Back to dashboard</Link>
      </div>

      {msg ? (
        <div style={{
          padding: 12, borderRadius: 10,
          background: msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error")
            ? "#ffe8e8" : "#eef6ff",
          border: "1px solid #ddd",
          margin: "12px 0"
        }}>
          {msg}
        </div>
      ) : null}

      {!canSee ? (
        <div style={{ padding: 12, borderRadius: 10, background: "#ffe8e8", border: "1px solid #f2b9b9" }}>
          Admin only.
        </div>
      ) : (
        <>
          {/* Add teacher */}
          <div style={{
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
            padding: 18,
            margin: "16px 0"
          }}>
            <h2 style={{ marginTop: 0 }}>Add teacher</h2>
            <form onSubmit={createTeacher} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name (e.g. Raquel Abeledo Pineiroa)"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", minWidth: 320 }}
              />
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email (e.g. raquel@busheymanor.local)"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", minWidth: 280 }}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
              </select>

              <select
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                <option value="">(no class)</option>
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                type="submit"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #0b1b2a",
                  background: "#0b1b2a",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Add teacher
              </button>
            </form>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              After adding, click <b>Send setup link</b> so they can set their password.
            </div>
          </div>

          {/* Teachers table */}
          <div style={{
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 16,
            padding: 18
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Teachers</h2>
              <button
                onClick={load}
                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #ccc", cursor: "pointer" }}
              >
                Refresh
              </button>
            </div>

            {loading ? <div>Loading…</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                    <th style={{ padding: "10px 8px" }}>Name</th>
                    <th style={{ padding: "10px 8px" }}>Email</th>
                    <th style={{ padding: "10px 8px" }}>Role</th>
                    <th style={{ padding: "10px 8px" }}>Assigned class</th>
                    <th style={{ padding: "10px 8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <TeacherRow
                      key={t.id || t.teacher_id}
                      t={t}
                      onSetRole={setRole}
                      onResetPassword={resetPassword}
                      onSendSetupLink={sendSetupLink}
                      onSaveClass={saveClass}
                    />
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 10, opacity: 0.8 }}>
              Tip: Set class for each teacher once. Admins can leave class blank.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TeacherRow({ t, onSetRole, onResetPassword, onSendSetupLink, onSaveClass }) {
  const teacherId = t.id || t.teacher_id;
  const [classLabel, setClassLabel] = useState(t.class_label || "");

  return (
    <tr style={{ borderBottom: "1px solid #f3f3f3" }}>
      <td style={{ padding: "14px 8px", fontWeight: 700 }}>{t.full_name || t.name || "(no name)"}</td>
      <td style={{ padding: "14px 8px" }}>{t.email}</td>
      <td style={{ padding: "14px 8px" }}>
        <span style={{
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #cbd7ff",
          background: "#eef2ff",
          fontWeight: 700
        }}>
          {t.role}
        </span>
      </td>

      <td style={{ padding: "14px 8px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={classLabel || ""}
            onChange={(e) => setClassLabel(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          >
            <option value="">(none)</option>
            {ALL_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => onSaveClass(teacherId, classLabel)}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #0b1b2a",
              background: "#0b1b2a",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Save
          </button>
        </div>
        <div style={{ marginTop: 6, opacity: 0.7, fontSize: 13 }}>
          Teachers will only see their assigned class.
        </div>
      </td>

      <td style={{ padding: "14px 8px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {t.role === "admin" ? (
            <button onClick={() => onSetRole(teacherId, "teacher")} style={btn()}>
              Make teacher
            </button>
          ) : (
            <button onClick={() => onSetRole(teacherId, "admin")} style={btn()}>
              Make admin
            </button>
          )}
          <button onClick={() => onResetPassword(teacherId)} style={btn()}>
            Reset password
          </button>
          <button onClick={() => onSendSetupLink(teacherId)} style={btn()}>
            Send setup link
          </button>
        </div>
      </td>
    </tr>
  );
}

function btn() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700
  };
}
