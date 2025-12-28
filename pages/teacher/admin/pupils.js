import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [pupils, setPupils] = useState([]);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [csvText, setCsvText] = useState(
    "class_label,first_name,last_name\nM4,Bob,Bobness"
  );

  const [search, setSearch] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // --------- styles ----------
  const styles = {
    page: { padding: 26, maxWidth: 1100, margin: "0 auto" },
    topRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14,
    },
    title: { margin: 0, fontSize: 44, letterSpacing: 0.2 },
    sub: { marginTop: 4, color: "#444" },
    card: {
      background: "#fff",
      borderRadius: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      border: "1px solid rgba(0,0,0,0.06)",
      padding: 18,
      marginTop: 14,
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    label: { fontSize: 14, color: "#333" },
    input: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ddd",
      minWidth: 220,
      outline: "none",
    },
    select: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ddd",
      outline: "none",
      background: "#fff",
    },
    btn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "#0f172a",
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
    },
    btnLight: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.12)",
      background: "#fff",
      color: "#0f172a",
      fontWeight: 700,
      cursor: "pointer",
    },
    btnDanger: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(239,68,68,0.55)",
      background: "#fff",
      color: "#b91c1c",
      fontWeight: 800,
      cursor: "pointer",
    },
    toastOk: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      background: "rgba(16,185,129,0.14)",
      border: "1px solid rgba(16,185,129,0.25)",
      color: "#065f46",
      fontWeight: 700,
    },
    toastErr: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      background: "rgba(239,68,68,0.10)",
      border: "1px solid rgba(239,68,68,0.22)",
      color: "#991b1b",
      fontWeight: 700,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 10,
    },
    th: {
      textAlign: "left",
      fontSize: 13,
      color: "#475569",
      borderBottom: "1px solid #e5e7eb",
      padding: "10px 8px",
    },
    td: {
      borderBottom: "1px solid #f1f5f9",
      padding: "10px 8px",
      verticalAlign: "middle",
    },
    pill: (bg, fg) => ({
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      background: bg,
      color: fg,
      border: "1px solid rgba(0,0,0,0.06)",
    }),
    mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
    small: { fontSize: 13, color: "#475569" },
    area: {
      width: "100%",
      minHeight: 160,
      padding: 12,
      borderRadius: 12,
      border: "1px solid #ddd",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      outline: "none",
    },
  };

  // --------- auth + classes ----------
  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        if (data.user?.role !== "admin") {
          window.location.href = "/teacher/dashboard";
          return;
        }
        setMe(data.user);
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.classes) && data.classes.length) {
          setClasses(data.classes);
          // pick first as default if current isn't present
          const labels = new Set(data.classes.map((c) => c.class_label));
          if (!labels.has(classLabel)) setClassLabel(data.classes[0].class_label);
        } else {
          // fallback list if needed
          setClasses([
            { class_label: "M4" },
            { class_label: "M3" },
            { class_label: "B4" },
            { class_label: "B3" },
          ]);
        }
      })
      .catch(() => {
        setClasses([
          { class_label: "M4" },
          { class_label: "M3" },
          { class_label: "B4" },
          { class_label: "B3" },
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------- load pupils ----------
  async function loadPupils(label = classLabel) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(label)}`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Failed to load pupils");
      setPupils(data.pupils || []);
    } catch (e) {
      setError(String(e.message || e));
      setPupils([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!me) return;
    loadPupils(classLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, classLabel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pupils;
    return pupils.filter((p) => {
      const name = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
      const u = (p.username || "").toLowerCase();
      return name.includes(q) || u.includes(q);
    });
  }, [pupils, search]);

  // --------- actions ----------
  async function addPupil() {
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/pupils/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_label: classLabel,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Failed to add pupil");

      // show the new PIN immediately
      setMessage(
        `Added ${data.pupil?.first_name || ""} ${data.pupil?.last_name || ""} — username: ${
          data.pupil?.username
        } — PIN: ${data.pin}`
      );
      setFirstName("");
      setLastName("");
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function resetPin(student_id) {
    setError("");
    setMessage("");
    if (!confirm("Reset this pupil's PIN? You will need to copy the new PIN.")) return;

    try {
      const r = await fetch("/api/admin/pupils/reset_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Failed to reset PIN");

      // show new PIN clearly
      alert(`New PIN: ${data.pin}`);
      setMessage(`PIN reset ✅ New PIN: ${data.pin}`);
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function deletePupil(student_id) {
    setError("");
    setMessage("");
    if (!confirm("Delete this pupil? This cannot be undone.")) return;

    try {
      const r = await fetch("/api/admin/pupils/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete pupil");
      setMessage("Pupil deleted ✅");
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function deleteAllInClass() {
    setError("");
    setMessage("");
    const confirmText = prompt(
      `Type DELETE to remove ALL pupils in ${classLabel} (and their attempts).`
    );
    if (confirmText !== "DELETE") return;

    try {
      const r = await fetch("/api/admin/pupils/delete_all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_label: classLabel }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Failed to delete pupils");
      setMessage(`Deleted ${data.deleted || 0} pupil(s) ✅`);
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function importCsv() {
    setError("");
    setMessage("");

    try {
      const r = await fetch("/api/admin/pupils/import_csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Import failed");

      setMessage(
        `Imported ${data.inserted || 0} pupil(s). Skipped ${data.skipped || 0}.`
      );
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function downloadPins() {
    setError("");
    setMessage("");

    try {
      const r = await fetch(
        `/api/admin/pupils/export_csv?class_label=${encodeURIComponent(classLabel)}`
      );
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Export failed");
      }
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pupils_${classLabel}_usernames_pins.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setMessage("Downloaded usernames + PINs ✅");
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  if (!me) return null;

  return (
    <div style={styles.page}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.title}>Manage Pupils</h1>
          <div style={styles.sub}>
            Logged in as <b>{me.email}</b>{" "}
            <span style={styles.pill("rgba(59,130,246,0.12)", "#1e3a8a")}>
              admin
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href="/teacher/dashboard">← Back to dashboard</Link>
          </div>
        </div>

        <button style={styles.btnLight} onClick={logout}>
          Log out
        </button>
      </div>

      {message && <div style={styles.toastOk}>{message}</div>}
      {error && <div style={styles.toastErr}>{error}</div>}

      {/* Class + Search + Download */}
      <div style={styles.card}>
        <div style={styles.row}>
          <div style={styles.label}>
            <b>Class</b>
          </div>
          <select
            style={styles.select}
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.class_label} value={c.class_label}>
                {c.class_label}
              </option>
            ))}
          </select>

          <input
            style={{ ...styles.input, minWidth: 320 }}
            placeholder="Search pupil name or username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button style={styles.btnLight} onClick={() => loadPupils(classLabel)}>
            Refresh
          </button>

          <button style={styles.btn} onClick={downloadPins}>
            Download usernames + PINs
          </button>

          <button style={styles.btnDanger} onClick={deleteAllInClass}>
            Delete ALL pupils in this class
          </button>
        </div>

        <div style={{ marginTop: 10, ...styles.small }}>
          Tip: Download works <b>any time</b> (not just after import).
        </div>
      </div>

      {/* Add pupil */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Add pupil</h2>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Surname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <button style={styles.btn} onClick={addPupil}>
            Add pupil
          </button>
        </div>
        <div style={{ marginTop: 10, ...styles.small }}>
          After adding, you’ll see their <b>username + PIN</b> so you can copy it straight away.
        </div>
      </div>

      {/* Bulk import */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Bulk import pupils</h2>
        <div style={styles.small}>
          Paste CSV with headers exactly:{" "}
          <span style={styles.mono}>class_label,first_name,last_name</span>
        </div>
        <textarea
          style={{ ...styles.area, marginTop: 10 }}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={styles.btn} onClick={importCsv}>
            Import CSV
          </button>
          <button style={styles.btnLight} onClick={downloadPins}>
            Download usernames + PINs for {classLabel}
          </button>
        </div>
      </div>

      {/* Pupils table */}
      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>
          Pupils in {classLabel}{" "}
          <span style={styles.pill("rgba(2,132,199,0.10)", "#075985")}>
            {loading ? "Loading…" : `${filtered.length} shown`}
          </span>
        </h2>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Username</th>
              <th style={styles.th}>PIN</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={styles.td}>
                  <b>
                    {(p.first_name || "").trim()} {(p.last_name || "").trim()}
                  </b>
                  {!p.last_name ? (
                    <div style={styles.small}>Surname missing</div>
                  ) : null}
                </td>

                <td style={{ ...styles.td, ...styles.mono }}>{p.username}</td>

                <td style={{ ...styles.td, ...styles.mono }}>
                  {p.pin ? (
                    <span style={styles.pill("rgba(16,185,129,0.14)", "#065f46")}>
                      {p.pin}
                    </span>
                  ) : (
                    <span style={styles.pill("rgba(148,163,184,0.20)", "#334155")}>
                      (hidden)
                    </span>
                  )}
                </td>

                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={styles.btnLight} onClick={() => resetPin(p.id)}>
                      Reset PIN
                    </button>
                    <button style={styles.btnDanger} onClick={() => deletePupil(p.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td style={styles.td} colSpan={4}>
                  No pupils found for this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 10, ...styles.small }}>
          If you can’t see PINs, it means your database column name is different.
          (Tell me what the column is called and I’ll adjust.)
        </div>
      </div>
    </div>
  );
}
