import React, { useEffect, useMemo, useState } from "react";

const CLASS_OPTIONS = ["B3", "B4", "B5", "B6", "M3", "M4", "M5", "M6"];

export default function TeacherAdminPage() {
  const [me, setMe] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [savingId, setSavingId] = useState(null);
  const [draftClass, setDraftClass] = useState({}); // { teacherId: "M3" }

  async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    const text = await r.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new Error(`Bad JSON from ${url}: ${text?.slice(0, 200)}`);
    }
    if (!r.ok) {
      throw new Error(json?.error || `Request failed (${r.status})`);
    }
    return json;
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    try {
      const who = await fetchJSON("/api/teacher/whoami?debug=1");
      setMe(who);

      // existing endpoint you already have (working page)
      const list = await fetchJSON("/api/admin/teachers/list");
      const rows = list?.teachers || list?.rows || list?.data || [];
      setTeachers(rows);

      // seed draft values from existing class_label
      const map = {};
      for (const t of rows) map[t.id] = t.class_label || "";
      setDraftClass(map);
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const isAdmin = useMemo(() => {
    return me?.parsedRole === "admin" || me?.role === "admin" || me?.teacher?.role === "admin";
  }, [me]);

  async function actionPOST(url, body, okMessage) {
    setMsg(null);
    try {
      const r = await fetchJSON(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (okMessage) setMsg(okMessage);
      await loadAll();
      return r;
    } catch (e) {
      setMsg(String(e.message || e));
      return null;
    }
  }

  async function setTeacherClass(teacherId) {
    setSavingId(teacherId);
    setMsg(null);
    try {
      const chosen = (draftClass[teacherId] || "").trim();
      const r = await fetchJSON("/api/admin/teachers/set_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacherId, class_label: chosen }),
      });
      setMsg(`Saved class for teacher.`);
      await loadAll();
      return r;
    } catch (e) {
      setMsg(String(e.message || e));
      return null;
    } finally {
      setSavingId(null);
    }
  }

  // These endpoints already exist on your working page:
  function makeAdmin(id) {
    return actionPOST("/api/admin/teachers/make_admin", { teacher_id: id }, "Role updated.");
  }
  function makeTeacher(id) {
    return actionPOST("/api/admin/teachers/make_teacher", { teacher_id: id }, "Role updated.");
  }
  function resetPassword(id) {
    return actionPOST("/api/admin/teachers/reset_password", { teacher_id: id }, "Password reset.");
  }
  function sendSetupLink(id) {
    return actionPOST("/api/admin/teachers/send_setup_link", { teacher_id: id }, "Setup link sent.");
  }

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 52, margin: "0 0 6px 0" }}>Manage Teachers</h1>
      <div style={{ marginBottom: 14, opacity: 0.8 }}>
        Logged in as <b>{me?.parsedKeys?.includes?.("email") ? me?.parsedKeys : ""}</b>
      </div>

      <div style={{ marginBottom: 16 }}>
        <a href="/teacher/dashboard">← Back to dashboard</a>
      </div>

      {msg && (
        <div style={{ background: "#ffe5e5", border: "1px solid #ffb3b3", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {!isAdmin && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffe69c", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          This page is admin-only.
        </div>
      )}

      <div style={{ background: "white", border: "1px solid #e6e6e6", borderRadius: 16, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Teachers</div>
          <button onClick={loadAll} disabled={loading} style={btn()}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th()}>Name</th>
                <th style={th()}>Email</th>
                <th style={th()}>Role</th>
                <th style={th()}>Assigned class</th>
                <th style={th()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td()}>
                    <b>{t.full_name || t.name || "(no name)"}</b>
                  </td>
                  <td style={td()}>{t.email}</td>
                  <td style={td()}>
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                      {t.role}
                    </span>
                  </td>

                  <td style={td()}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={draftClass[t.id] ?? ""}
                        onChange={(e) => setDraftClass((p) => ({ ...p, [t.id]: e.target.value }))}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #ddd",
                          minWidth: 90,
                          background: "white",
                        }}
                        disabled={!isAdmin}
                      >
                        <option value="">(none)</option>
                        {CLASS_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setTeacherClass(t.id)}
                        disabled={!isAdmin || savingId === t.id}
                        style={btnPrimary(savingId === t.id)}
                        title="Save this teacher's class"
                      >
                        {savingId === t.id ? "Saving..." : "Save"}
                      </button>
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      Teachers will only see their assigned class.
                    </div>
                  </td>

                  <td style={td()}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {t.role === "admin" ? (
                        <button onClick={() => makeTeacher(t.id)} disabled={!isAdmin} style={btn()}>
                          Make teacher
                        </button>
                      ) : (
                        <button onClick={() => makeAdmin(t.id)} disabled={!isAdmin} style={btn()}>
                          Make admin
                        </button>
                      )}

                      <button onClick={() => resetPassword(t.id)} disabled={!isAdmin} style={btn()}>
                        Reset password
                      </button>

                      <button onClick={() => sendSetupLink(t.id)} disabled={!isAdmin} style={btn()}>
                        Send setup link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {teachers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, opacity: 0.7 }}>
                    {loading ? "Loading..." : "No teachers found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>
          Tip: Set class for each teacher once. Admins can leave class blank.
        </div>
      </div>
    </div>
  );
}

function th() {
  return { padding: "10px 10px", fontSize: 12, opacity: 0.75, borderBottom: "1px solid #eee" };
}
function td() {
  return { padding: "12px 10px", verticalAlign: "top" };
}
function btn() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d5d5d5",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  };
}
function btnPrimary(loading) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: loading ? "#111827" : "#111827",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  };
}
