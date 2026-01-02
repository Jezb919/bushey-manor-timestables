import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Bad JSON from server", raw: text };
  }
}

export default function ManageTeachers() {
  const [me, setMe] = useState(null);

  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [loading, setLoading] = useState(false);

  // msg can optionally include extra data (setup_url / temp_password)
  const [msg, setMsg] = useState(null); // {type:'error'|'ok', text:string, setup_url?, temp_password?}

  // Add teacher form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newClass, setNewClass] = useState("");

  // Per-teacher selection for assigned class
  const [selectedClassByTeacher, setSelectedClassByTeacher] = useState({}); // { [teacher_id]: class_label }

  const loggedInLabel = useMemo(() => {
    if (!me?.ok) return "unknown";
    const email = me.parsedEmail || me.email || "unknown";
    const role = me.parsedRole || me.role || "unknown";
    return `${email} (${role})`;
  }, [me]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    try {
      // whoami (for header)
      const who = await fetch("/api/teacher/whoami?debug=1");
      const whoJ = await safeJson(who);
      setMe({
        ok: whoJ.ok,
        parsedEmail: whoJ?.parsedEmail || whoJ?.parsed?.email || whoJ?.debug?.email,
        parsedRole: whoJ?.parsedRole || whoJ?.parsed?.role || whoJ?.debug?.role,
        parsedFullName: whoJ?.parsedFullName || whoJ?.parsed?.full_name || whoJ?.debug?.full_name,
        raw: whoJ,
      });

      // classes
      const cRes = await fetch("/api/admin/classes/list?debug=1");
      const cJ = await safeJson(cRes);
      if (!cJ.ok) throw new Error(cJ.error || "Failed to load classes");
      setClasses(cJ.classes || []);

      // teachers
      const tRes = await fetch("/api/admin/teachers/list?debug=1");
      const tJ = await safeJson(tRes);
      if (!tJ.ok) throw new Error(tJ.error || "Failed to load teachers");
      const list = tJ.teachers || [];
      setTeachers(list);

      // initialise selections
      const map = {};
      for (const t of list) {
        map[t.id] = t.class_label || "";
      }
      setSelectedClassByTeacher(map);

      setMsg({ type: "ok", text: "Loaded." });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTeacherClassChoice(teacherId, classLabel) {
    setSelectedClassByTeacher((prev) => ({ ...prev, [teacherId]: classLabel }));
  }

  async function saveTeacherClass(teacher) {
    setLoading(true);
    setMsg(null);

    try {
      const class_label = selectedClassByTeacher[teacher.id] || ""; // '' clears

      const res = await fetch("/api/admin/teachers/set_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacher.id,
          class_label: class_label === "(none)" ? "" : class_label,
        }),
      });

      const j = await safeJson(res);
      if (!j.ok) throw new Error(j.error || "Failed to assign class");

      await loadAll();
      setMsg({
        type: "ok",
        text: `Saved class for ${teacher.full_name || teacher.email || "teacher"}.`,
      });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function addTeacher() {
    setLoading(true);
    setMsg(null);

    try {
      if (!newName.trim()) throw new Error("Please enter a full name.");
      if (!newEmail.trim()) throw new Error("Please enter an email.");

      const res = await fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          class_label: newClass || "",
        }),
      });

      const j = await safeJson(res);
      if (!j.ok) throw new Error(j.error || "Failed to create teacher");

      setNewName("");
      setNewEmail("");
      setNewRole("teacher");
      setNewClass("");

      await loadAll();
      setMsg({
        type: "ok",
        text: "Teacher created. Now click “Send setup link” to create a link you can copy/paste to them.",
      });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function callAction(url, body) {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const j = await safeJson(res);
      if (!j.ok) throw new Error(j.error || "Action failed");

      await loadAll();

      // show helpful returned data (setup link / temp password)
      setMsg({
        type: "ok",
        text: j.info || "Done.",
        setup_url: j.setup_url,
        temp_password: j.temp_password,
      });
    } catch (e) {
      setMsg({ type: "error", text: String(e.message || e) });
    } finally {
      setLoading(false);
    }
  }

  const classOptions = useMemo(() => {
    const labels = (classes || []).map((c) => c.class_label).filter(Boolean);
    labels.sort((a, b) => a.localeCompare(b));
    return labels;
  }, [classes]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 56, margin: "0 0 8px 0" }}>Manage Teachers</h1>

      <div style={{ marginBottom: 12, color: "#333" }}>
        <div>
          Logged in as <b>{loggedInLabel}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          <Link href="/teacher/dashboard">← Back to dashboard</Link>
        </div>
      </div>

      {msg?.type === "error" && (
        <div
          style={{
            background: "#fde8e8",
            border: "1px solid #f5b5b5",
            padding: 14,
            borderRadius: 10,
            margin: "14px 0",
          }}
        >
          <b>Server error</b>: {msg.text}
        </div>
      )}

      {msg?.type === "ok" && (
        <div
          style={{
            background: "#ecfdf3",
            border: "1px solid #b7f0c9",
            padding: 14,
            borderRadius: 10,
            margin: "14px 0",
          }}
        >
          <div>{msg.text}</div>

          {msg.setup_url && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Setup link (copy/paste to teacher):</div>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 10,
                  wordBreak: "break-all",
                }}
              >
                {msg.setup_url}
              </div>
            </div>
          )}

          {msg.temp_password && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Temporary password (give to teacher):</div>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 10,
                  fontFamily: "monospace",
                  fontSize: 16,
                }}
              >
                {msg.temp_password}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add teacher */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
          marginTop: 18,
        }}
      >
        <h2 style={{ fontSize: 34, margin: "0 0 12px 0" }}>Add teacher</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.2fr 160px 160px 160px",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name (e.g. Raquel Abeledo Pineiroa)"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email (e.g. raquel@busheymanor.local)"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          >
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>

          <select
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          >
            <option value="">(no class)</option>
            {classOptions.map((lbl) => (
              <option key={lbl} value={lbl}>
                {lbl}
              </option>
            ))}
          </select>

          <button
            onClick={addTeacher}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Add teacher
          </button>
        </div>

        <div style={{ marginTop: 10, color: "#555" }}>
          After adding, click <b>Send setup link</b> to create a link you can copy/paste.
        </div>
      </div>

      {/* Teachers list */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
          marginTop: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 34, margin: 0 }}>Teachers</h2>
          <button
            onClick={loadAll}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "#f6f6f6",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid #eee" }} />

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "10px 8px" }}>Name</th>
              <th style={{ padding: "10px 8px" }}>Email</th>
              <th style={{ padding: "10px 8px" }}>Role</th>
              <th style={{ padding: "10px 8px" }}>Assigned class</th>
              <th style={{ padding: "10px 8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(teachers || []).map((t) => {
              const current = selectedClassByTeacher[t.id] ?? (t.class_label || "");
              return (
                <tr key={t.id} style={{ borderTop: "1px solid #eee", verticalAlign: "top" }}>
                  <td style={{ padding: "14px 8px", fontWeight: 800 }}>{t.full_name || "—"}</td>
                  <td style={{ padding: "14px 8px" }}>
                    <span style={{ fontWeight: 700 }}>{t.email}</span>
                  </td>
                  <td style={{ padding: "14px 8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #c7d2fe",
                        background: "#eef2ff",
                        fontWeight: 700,
                      }}
                    >
                      {t.role}
                    </span>
                  </td>

                  <td style={{ padding: "14px 8px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <select
                        value={current || "(none)"}
                        onChange={(e) =>
                          setTeacherClassChoice(t.id, e.target.value === "(none)" ? "" : e.target.value)
                        }
                        style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", minWidth: 140 }}
                      >
                        <option value="(none)">(none)</option>
                        {classOptions.map((lbl) => (
                          <option key={lbl} value={lbl}>
                            {lbl}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => saveTeacherClass(t)}
                        disabled={loading}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid #111827",
                          background: "#111827",
                          color: "white",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                    </div>
                    <div style={{ marginTop: 6, color: "#555" }}>Teachers will only see their assigned class.</div>
                  </td>

                  <td style={{ padding: "14px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {t.role === "admin" ? (
                        <button
                          onClick={() => callAction("/api/admin/teachers/make_teacher", { teacher_id: t.id })}
                          disabled={loading}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ccc",
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Make teacher
                        </button>
                      ) : (
                        <button
                          onClick={() => callAction("/api/admin/teachers/make_admin", { teacher_id: t.id })}
                          disabled={loading}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid #ccc",
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Make admin
                        </button>
                      )}

                      <button
                        onClick={() => callAction("/api/admin/teachers/reset_password", { teacher_id: t.id })}
                        disabled={loading}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #ccc",
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Reset password
                      </button>

                      <button
                        onClick={() => callAction("/api/admin/teachers/send_setup_link", { teacher_id: t.id })}
                        disabled={loading}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #ccc",
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Send setup link
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 14, color: "#555" }}>Tip: Set class for each teacher once. Admins can leave class blank.</div>
      </div>
    </div>
  );
}
