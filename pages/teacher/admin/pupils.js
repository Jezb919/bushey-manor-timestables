import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function ManagePupilsPage() {
  const [me, setMe] = useState(null);

  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [pupils, setPupils] = useState([]);
  const [search, setSearch] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [csvText, setCsvText] = useState("class_label,first_name,last_name\n");
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);

  // --- load teacher session
  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(data.user);
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  // --- load classes (dropdown)
  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;

        const list = data.classes || [];
        setClasses(list);

        // If current classLabel isn't in returned classes, set it to first available
        if (list.length > 0) {
          const labels = new Set(list.map((c) => c.label));
          if (!labels.has(classLabel)) setClassLabel(list[0].label);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPupils() {
    setMessage("");
    try {
      const r = await fetch(
        `/api/admin/pupils/list?class_label=${encodeURIComponent(classLabel)}`
      );
      const data = await r.json();
      if (!data.ok) {
        setMessage(data.error || "Failed to load pupils");
        setPupils([]);
        return;
      }
      setPupils(data.pupils || []);
    } catch {
      setMessage("Failed to load pupils");
      setPupils([]);
    }
  }

  useEffect(() => {
    if (!me) return;
    if (me.role !== "admin") return;
    loadPupils();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, classLabel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pupils;
    return pupils.filter((p) => {
      const full = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
      const u = (p.username || "").toLowerCase();
      return full.includes(q) || u.includes(q);
    });
  }, [pupils, search]);

  async function addPupil() {
    setMessage("");
    if (!firstName.trim() || !lastName.trim()) {
      setMessage("Please enter first name and surname.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_label: classLabel,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        setMessage(data.error || "Failed to add pupil");
        return;
      }
      // show the new credentials clearly
      if (data.pupil?.username && data.pupil?.pin) {
        alert(
          `Pupil created:\n\nUsername: ${data.pupil.username}\nPIN: ${data.pupil.pin}\n\nCopy these now.`
        );
      } else {
        alert("Pupil created. (No username/PIN returned from server.)");
      }
      setFirstName("");
      setLastName("");
      await loadPupils();
    } catch {
      setMessage("Failed to add pupil");
    } finally {
      setBusy(false);
    }
  }

  async function bulkImport() {
    setMessage("");
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pupils/bulk_import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.ok) {
        setMessage(data?.error || `Request failed (${r.status})`);
        return;
      }

      const createdCount = data.created?.length || 0;
      const skippedCount = data.skipped?.length || 0;
      setMessage(`Imported ${createdCount}. Skipped ${skippedCount}.`);

      await loadPupils();
    } catch {
      setMessage("Bulk import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadUsernamesPins() {
    // downloads a CSV file from the API
    const url = `/api/admin/pupils/export_csv?class_label=${encodeURIComponent(
      classLabel
    )}`;
    window.location.href = url;
  }

  async function resetPin(studentId, pupilName) {
    setMessage("");
    const ok = window.confirm(
      `Reset this pupil's PIN?\n\n${pupilName}\n\nYou will need to copy the new PIN.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const r = await fetch("/api/admin/pupils/reset_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await r.json();
      if (!data.ok) {
        setMessage(data.error || "Failed to reset PIN");
        return;
      }
      alert(
        `New PIN for ${pupilName}:\n\n${data.pin}\n\nCopy it now.`
      );
      await loadPupils();
    } catch {
      setMessage("Failed to reset PIN");
    } finally {
      setBusy(false);
    }
  }

  async function deletePupil(studentId, pupilName) {
    setMessage("");
    const ok = window.confirm(`Delete this pupil?\n\n${pupilName}\n\nThis cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    try {
      const r = await fetch("/api/admin/pupils/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await r.json();
      if (!data.ok) {
        setMessage(data.error || "Failed to delete pupil");
        return;
      }
      await loadPupils();
    } catch {
      setMessage("Failed to delete pupil");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllInClass() {
    setMessage("");
    const ok = window.confirm(
      `Delete ALL pupils in class ${classLabel}?\n\nThis is for clearing test data / placeholders.\n\nIf some pupils have attempts, deletion may be blocked unless your DB allows cascade.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const r = await fetch("/api/admin/pupils/delete_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_label: classLabel }),
      });
      const data = await r.json();
      if (!data.ok) {
        setMessage(data.error || "Failed to delete pupils");
        return;
      }
      setMessage(`Deleted ${data.deleted || 0} pupils from ${classLabel}.`);
      await loadPupils();
    } catch {
      setMessage("Failed to delete pupils");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;
  if (me.role !== "admin") {
    return <div style={{ padding: 30 }}>Admins only.</div>;
  }

  const styles = {
    page: { padding: 30, maxWidth: 1100, margin: "0 auto" },
    topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
    badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, background: "#e8f0ff", fontSize: 12, marginLeft: 8 },
    alert: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      padding: 12,
      borderRadius: 14,
      margin: "14px 0",
      color: "#9f1239",
      fontWeight: 600,
    },
    card: {
      background: "#fff",
      border: "1px solid #eee",
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      marginTop: 16,
    },
    row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
    input: { padding: 10, borderRadius: 12, border: "1px solid #ddd", width: 260 },
    select: { padding: 10, borderRadius: 12, border: "1px solid #ddd" },
    btn: { padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontWeight: 700 },
    btnPrimary: { padding: "10px 14px", borderRadius: 12, border: "1px solid #0b1220", background: "#0b1220", color: "#fff", cursor: "pointer", fontWeight: 800 },
    btnDanger: { padding: "10px 14px", borderRadius: 12, border: "1px solid #ef4444", background: "#fff", color: "#b91c1c", cursor: "pointer", fontWeight: 900 },
    table: { width: "100%", borderCollapse: "collapse", marginTop: 10 },
    th: { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #eee", fontSize: 13, color: "#334155" },
    td: { padding: "10px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
    mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
    small: { fontSize: 12, color: "#64748b" },
    textarea: { width: "100%", minHeight: 160, borderRadius: 14, border: "1px solid #ddd", padding: 12, fontFamily: "ui-monospace, monospace" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.topRow}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Manage Pupils</h1>
          <div style={{ color: "#334155" }}>
            Logged in as <b>{me.email}</b>
            <span style={styles.badge}>{me.role}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/teacher">← Back to dashboard</Link>
          </div>
        </div>
      </div>

      {message && <div style={styles.alert}>{message}</div>}

      {/* Controls */}
      <div style={styles.card}>
        <div style={styles.row}>
          <label style={{ fontWeight: 800 }}>Class</label>
          <select
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
            style={styles.select}
          >
            {classes.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
            {classes.length === 0 && (
              <>
                <option value="M4">M4</option>
                <option value="B4">B4</option>
                <option value="B3">B3</option>
              </>
            )}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pupil name or username…"
            style={styles.input}
          />

          <button style={styles.btn} onClick={loadPupils} disabled={busy}>
            Refresh
          </button>

          <button style={styles.btnPrimary} onClick={downloadUsernamesPins} disabled={busy}>
            Download usernames + PINs
          </button>

          <button style={styles.btnDanger} onClick={deleteAllInClass} disabled={busy}>
            Delete ALL pupils in this class
          </button>
        </div>

        <div style={{ ...styles.small, marginTop: 10 }}>
          Tip: Download works any time (not just after import).
        </div>
      </div>

      {/* Add pupil */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Add pupil</h2>
        <div style={styles.row}>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            style={styles.input}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Surname"
            style={styles.input}
          />
          <button style={styles.btnPrimary} onClick={addPupil} disabled={busy}>
            Add pupil
          </button>
        </div>
        <div style={{ ...styles.small, marginTop: 10 }}>
          After adding, you’ll see their <b>username + PIN</b> so you can copy it straight away.
        </div>
      </div>

      {/* Bulk import */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Bulk import pupils</h2>
        <div style={{ ...styles.small, marginBottom: 10 }}>
          Paste CSV with headers exactly: <b>class_label,first_name,last_name</b>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          style={styles.textarea}
        />
        <div style={{ marginTop: 10 }}>
          <button style={styles.btnPrimary} onClick={bulkImport} disabled={busy}>
            Import CSV
          </button>
        </div>
      </div>

      {/* List */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Pupils in {classLabel}</h2>

        {filtered.length === 0 ? (
          <div style={styles.small}>No pupils found.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>PIN</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "(no name)";
                return (
                  <tr key={p.id}>
                    <td style={styles.td}><b>{name}</b></td>
                    <td style={{ ...styles.td, ...styles.mono }}>{p.username}</td>
                    <td style={{ ...styles.td, ...styles.mono }}>{p.pin || "—"}</td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={styles.btn}
                          onClick={() => resetPin(p.id, name)}
                          disabled={busy}
                        >
                          Reset PIN
                        </button>
                        <button
                          style={styles.btnDanger}
                          onClick={() => deletePupil(p.id, name)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
