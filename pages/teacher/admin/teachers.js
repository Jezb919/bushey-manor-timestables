import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const DEFAULT_CLASS_LABELS = ["B3", "B4", "B5", "B6", "M3", "M4", "M5", "M6"];

// ---- If your API endpoints differ, change them here ----
const API = {
  whoami: "/api/teacher/whoami?debug=1",
  listTeachers: "/api/admin/teachers/list",
  createTeacher: "/api/admin/teachers/create",
  setClass: "/api/admin/teachers/set_class",
  makeAdmin: "/api/admin/teachers/make_admin",
  makeTeacher: "/api/admin/teachers/make_teacher",
  resetPassword: "/api/admin/teachers/reset_password",
  sendSetupLink: "/api/admin/teachers/send_setup_link",
  // optional if you have it:
  listClasses: "/api/admin/classes/list",
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-json response
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `Request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export default function ManageTeachers() {
  const [me, setMe] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState(DEFAULT_CLASS_LABELS);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Add teacher form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [newClass, setNewClass] = useState("(none)");

  const roleBadge = useMemo(() => {
    const r = me?.parsedRole || me?.role;
    return r ? String(r) : "unknown";
  }, [me]);

  const meLabel = useMemo(() => {
    const e = me?.email || me?.parsedEmail || me?.parsedKeys?.email;
    const name = me?.full_name || me?.parsedFullName;
    return name || e || "unknown";
  }, [me]);

  async function loadAll() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      // whoami
      try {
        const who = await fetchJson(API.whoami);
        setMe(who);
      } catch {
        // whoami is helpful but not essential
      }

      // classes (optional endpoint). If it fails, we fall back.
      try {
        const c = await fetchJson(API.listClasses);
        // Accept common shapes:
        // { ok:true, classes:[{class_label:"B3"}] } OR {classes:["B3"]} OR [{class_label:"B3"}]
        const raw = c?.classes ?? c;
        const labels = Array.isArray(raw)
          ? raw
              .map((x) => (typeof x === "string" ? x : x?.class_label))
              .filter(Boolean)
          : [];
        if (labels.length) setClasses(labels);
      } catch {
        // ignore
      }

      // teachers
      const t = await fetchJson(API.listTeachers);
      const rows = t?.teachers ?? t?.rows ?? t;
      setTeachers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateTeacher() {
    setErr("");
    setMsg("");
    try {
      if (!fullName.trim()) throw new Error("Please enter full name");
      if (!email.trim()) throw new Error("Please enter email");

      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        class_label: newClass && newClass !== "(none)" ? newClass : null,
      };

      await fetchJson(API.createTeacher, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg("Teacher created.");
      setFullName("");
      setEmail("");
      setRole("teacher");
      setNewClass("(none)");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Failed to create teacher");
    }
  }

  async function onSaveClass(t) {
    setErr("");
    setMsg("");
    setBusyId(t.id);
    try {
      const class_label =
        t._pendingClass && t._pendingClass !== "(none)" ? t._pendingClass : null;

      await fetchJson(API.setClass, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: t.id, class_label }),
      });

      setMsg("Saved.");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Failed to save class");
    } finally {
      setBusyId(null);
    }
  }

  async function callAction(url, body) {
    setErr("");
    setMsg("");
    setBusyId(body?.teacher_id || "busy");
    try {
      await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      setMsg("Done.");
      await loadAll();
    } catch (e) {
      setErr(e.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function updatePendingClass(teacherId, value) {
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === teacherId ? { ...t, _pendingClass: value } : t
      )
    );
  }

  const containerStyle = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px 16px 64px",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
    marginTop: 16,
  };

  const pill = (bg) => ({
    display: "inline-block",
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: bg || "#f3f4f6",
    marginLeft: 8,
    verticalAlign: "middle",
  });

  const btn = (variant) => {
    const base = {
      borderRadius: 10,
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      background: "#fff",
      cursor: "pointer",
      fontWeight: 600,
      marginRight: 8,
      marginBottom: 8,
      whiteSpace: "nowrap",
    };
    if (variant === "primary")
      return { ...base, background: "#111827", color: "#fff", borderColor: "#111827" };
    if (variant === "danger")
      return { ...base, background: "#fff", borderColor: "#ef4444", color: "#b91c1c" };
    return base;
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 46, margin: 0, letterSpacing: -1 }}>Manage Teachers</h1>

      <div style={{ marginTop: 8, color: "#374151" }}>
        Logged in as <b>{meLabel}</b>
        <span style={pill("#e0f2fe")}>{roleBadge}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <Link href="/teacher/dashboard">← Back to dashboard</Link>
      </div>

      {(err || msg) && (
        <div
          style={{
            ...cardStyle,
            borderColor: err ? "#fecaca" : "#bbf7d0",
            background: err ? "#fef2f2" : "#f0fdf4",
          }}
        >
          <b style={{ color: err ? "#991b1b" : "#166534" }}>
            {err ? err : msg}
          </b>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Add teacher</h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: 10 }}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name (e.g. Raquel Abeledo Pineiroa)"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (e.g. raquel@busheymanor.local)"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>

          <select
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          >
            <option>(none)</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button style={btn("primary")} onClick={onCreateTeacher} disabled={loading}>
            Add teacher
          </button>
        </div>

        <div style={{ marginTop: 10, color: "#6b7280" }}>
          After adding, click <b>Send setup link</b> so they can set their password.
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ marginTop: 0 }}>Teachers</h2>
          <button style={btn()} onClick={loadAll} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>Role</th>
                <th style={{ padding: "10px 8px" }}>Assigned class</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {teachers.map((t) => {
                const assigned = t.class_label || t.assigned_class || t.classLabel || null;
                const pending = t._pendingClass ?? (assigned || "(none)");
                const busy = busyId === t.id;

                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>
                      {t.full_name || t.name || "—"}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{t.email || "—"}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={pill(t.role === "admin" ? "#e0f2fe" : "#eef2ff")}>
                        {t.role || "—"}
                      </span>
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={pending}
                          onChange={(e) => updatePendingClass(t.id, e.target.value)}
                          style={{ padding: 10, borderRadius: 10, border: "1px solid #d1d5db", minWidth: 140 }}
                        >
                          <option>(none)</option>
                          {classes.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>

                        <button style={btn("primary")} onClick={() => onSaveClass(t)} disabled={busy}>
                          {busy ? "Saving..." : "Save"}
                        </button>
                      </div>

                      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
                        Teachers will only see their assigned class.
                      </div>
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        {t.role === "admin" ? (
                          <button
                            style={btn()}
                            disabled={busy}
                            onClick={() => callAction(API.makeTeacher, { teacher_id: t.id })}
                          >
                            Make teacher
                          </button>
                        ) : (
                          <button
                            style={btn()}
                            disabled={busy}
                            onClick={() => callAction(API.makeAdmin, { teacher_id: t.id })}
                          >
                            Make admin
                          </button>
                        )}

                        <button
                          style={btn()}
                          disabled={busy}
                          onClick={() => callAction(API.resetPassword, { teacher_id: t.id })}
                        >
                          Reset password
                        </button>

                        <button
                          style={btn()}
                          disabled={busy}
                          onClick={() => callAction(API.sendSetupLink, { teacher_id: t.id })}
                        >
                          Send setup link
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!teachers.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#6b7280" }}>
                    No teachers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, color: "#6b7280" }}>
          Tip: Set class for each teacher once. Admins can leave class blank.
        </div>
      </div>
    </div>
  );
}
