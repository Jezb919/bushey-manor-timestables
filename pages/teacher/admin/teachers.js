// pages/teacher/admin/teachers.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function pickLink(json) {
  if (!json) return null;
  // Common places the API might put the URL
  return (
    json.setup_link ||
    json.setupLink ||
    json.link ||
    json.url ||
    json.setup_url ||
    json.setupUrl ||
    (json.data && (json.data.setup_link || json.data.link || json.data.url)) ||
    (json.debug && (json.debug.setup_link || json.debug.link || json.debug.url)) ||
    null
  );
}

export default function ManageTeachersPage() {
  const [me, setMe] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [setupLink, setSetupLink] = useState("");
  const [rawResponse, setRawResponse] = useState(null);

  // Add teacher form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("teacher");
  const [classLabel, setClassLabel] = useState("");

  const classOptions = useMemo(() => {
    const labels = (classes || [])
      .map((c) => c.class_label)
      .filter(Boolean)
      .sort();
    return ["", ...labels];
  }, [classes]);

  async function loadAll() {
    setLoading(true);
    setError("");
    setStatus("");
    try {
      // who am I?
      const meRes = await fetch("/api/teacher/me");
      const meJson = await meRes.json().catch(() => null);
      setMe(meJson?.me || meJson?.teacher || meJson?.session || null);

      // classes
      const clsRes = await fetch("/api/admin/classes/list");
      const clsJson = await clsRes.json().catch(() => null);
      if (!clsRes.ok || !clsJson?.ok) {
        throw new Error(clsJson?.error || "Could not load classes");
      }
      setClasses(clsJson.classes || []);

      // teachers
      const tRes = await fetch("/api/admin/teachers/list");
      const tJson = await tRes.json().catch(() => null);
      if (!tRes.ok || !tJson?.ok) {
        throw new Error(tJson?.error || "Could not load teachers");
      }
      setTeachers(tJson.teachers || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const json = await res.json().catch(() => null);
    return { res, json };
  }

  async function addTeacher() {
    setError("");
    setStatus("");
    setSetupLink("");
    setRawResponse(null);

    if (!fullName.trim() || !email.trim()) {
      setError("Please enter full name and email.");
      return;
    }

    try {
      const { res, json } = await postJSON("/api/admin/teachers/create", {
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        class_label: classLabel || null,
      });

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to add teacher");
      }

      setStatus("Teacher created.");
      setFullName("");
      setEmail("");
      setRole("teacher");
      setClassLabel("");
      await loadAll();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function saveClass(t) {
    setBusyId(t.id);
    setError("");
    setStatus("");
    setSetupLink("");
    setRawResponse(null);

    try {
      const { res, json } = await postJSON("/api/admin/teachers/set_class", {
        teacher_id: t.id,
        class_label: t.class_label || null,
      });

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to assign class");
      }

      setStatus(`Saved class for ${t.full_name || t.email}.`);
      await loadAll();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(t) {
    setBusyId(t.id);
    setError("");
    setStatus("");
    setSetupLink("");
    setRawResponse(null);

    const nextRole = t.role === "admin" ? "teacher" : "admin";

    try {
      const { res, json } = await postJSON("/api/admin/teachers/set_role", {
        teacher_id: t.id,
        role: nextRole,
      });

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to change role");
      }

      setStatus(`Updated role for ${t.full_name || t.email}.`);
      await loadAll();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function sendSetupLink(t) {
    setBusyId(t.id);
    setError("");
    setStatus("");
    setSetupLink("");
    setRawResponse(null);

    try {
      const { res, json } = await postJSON("/api/admin/teachers/send_setup_link", {
        teacher_id: t.id,
      });

      // Always keep the raw response so we can see what came back
      setRawResponse(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to create setup link");
      }

      const link = pickLink(json);

      if (!link) {
        // This is your current problem: success message but no visible link.
        // So we show the whole response to reveal where the URL actually is.
        setStatus("Setup link created, but the URL field name was not recognised. See response below.");
        return;
      }

      setSetupLink(link);
      setStatus("Setup link created (copy/paste to the teacher).");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(t) {
    setBusyId(t.id);
    setError("");
    setStatus("");
    setSetupLink("");
    setRawResponse(null);

    try {
      const { res, json } = await postJSON("/api/admin/teachers/reset_password", {
        teacher_id: t.id,
      });

      setRawResponse(json);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Reset password failed");
      }

      // Some implementations return a setup link here too.
      const link = pickLink(json);
      if (link) setSetupLink(link);

      setStatus("Password reset. If a setup link is shown, copy/paste it to the teacher.");
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  function updateTeacherLocal(id, patch) {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 56, margin: "0 0 8px" }}>Manage Teachers</h1>

      <div style={{ marginBottom: 10 }}>
        <div style={{ opacity: 0.8 }}>
          Logged in as <b>{me?.email || "unknown"}</b> ({me?.role || "admin"})
        </div>
        <div style={{ marginTop: 8 }}>
          <Link href="/teacher/dashboard">← Back to dashboard</Link>
        </div>
      </div>

      {error ? (
        <div style={{ background: "#ffe5e5", border: "1px solid #f1b0b0", padding: 14, borderRadius: 10, margin: "12px 0" }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      {status ? (
        <div style={{ background: "#e9fff0", border: "1px solid #9fe2b1", padding: 14, borderRadius: 10, margin: "12px 0" }}>
          {status}
        </div>
      ) : null}

      {setupLink ? (
        <div style={{ background: "#e9fff0", border: "1px solid #9fe2b1", padding: 14, borderRadius: 10, margin: "12px 0" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Setup link (copy/paste to teacher):</div>
          <input
            value={setupLink}
            readOnly
            onFocus={(e) => e.target.select()}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ccc",
              fontSize: 14,
            }}
          />
        </div>
      ) : null}

      {/* If we couldn't find the link field, show the raw JSON so we can see what's happening */}
      {rawResponse && !setupLink ? (
        <div style={{ background: "#f6f6f6", border: "1px solid #ddd", padding: 14, borderRadius: 10, margin: "12px 0" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>API response (for debugging)</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      ) : null}

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 18, marginTop: 16 }}>
        <h2 style={{ fontSize: 40, margin: "0 0 14px" }}>Add teacher</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name (e.g. Raquel Abeledo Pineiroa)"
            style={{ flex: "1 1 260px", padding: 12, borderRadius: 12, border: "1px solid #d0d7de" }}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (e.g. raquel@busheymanor.local)"
            style={{ flex: "1 1 260px", padding: 12, borderRadius: 12, border: "1px solid #d0d7de" }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d7de" }}>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid #d0d7de" }}>
            <option value="">(no class)</option>
            {classOptions
              .filter((x) => x)
              .map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
          </select>
          <button
            onClick={addTeacher}
            style={{
              padding: "12px 18px",
              borderRadius: 14,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 700,
            }}
          >
            Add teacher
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.8 }}>
          After adding, click <b>Send setup link</b> to create a link you can copy/paste.
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 18, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2 style={{ fontSize: 40, margin: 0 }}>Teachers</h2>
          <button
            onClick={loadAll}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d7de", background: "#f3f4f6", fontWeight: 600 }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ marginTop: 12 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
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
                {(teachers || []).map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>{t.full_name || t.fullName || "(no name)"}</td>
                    <td style={{ padding: "12px 8px" }}>{t.email}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #c7d2fe", background: "#eef2ff", fontWeight: 700 }}>
                        {t.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <select
                        value={t.class_label || ""}
                        onChange={(e) => updateTeacherLocal(t.id, { class_label: e.target.value })}
                        style={{ padding: 10, borderRadius: 12, border: "1px solid #d0d7de" }}
                      >
                        <option value="">(none)</option>
                        {classOptions
                          .filter((x) => x)
                          .map((lbl) => (
                            <option key={lbl} value={lbl}>
                              {lbl}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={busyId === t.id}
                        onClick={() => saveClass(t)}
                        style={{
                          marginLeft: 10,
                          padding: "10px 14px",
                          borderRadius: 12,
                          border: "1px solid #111827",
                          background: "#111827",
                          color: "white",
                          fontWeight: 700,
                          opacity: busyId === t.id ? 0.6 : 1,
                        }}
                      >
                        Save
                      </button>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Teachers will only see their assigned class.</div>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          disabled={busyId === t.id}
                          onClick={() => toggleRole(t)}
                          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d7de", background: "#fff", fontWeight: 700 }}
                        >
                          {t.role === "admin" ? "Make teacher" : "Make admin"}
                        </button>

                        <button
                          disabled={busyId === t.id}
                          onClick={() => resetPassword(t)}
                          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d7de", background: "#fff", fontWeight: 700 }}
                        >
                          Reset password
                        </button>

                        <button
                          disabled={busyId === t.id}
                          onClick={() => sendSetupLink(t)}
                          style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #d0d7de", background: "#fff", fontWeight: 700 }}
                        >
                          Send setup link
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {(!teachers || teachers.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
