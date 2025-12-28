// pages/teacher/admin/pupils.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [csvText, setCsvText] = useState("class_label,first_name,last_name\n");
  const [importResult, setImportResult] = useState(null);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const canUsePage = useMemo(() => me && me.role === "admin", [me]);

  // --- Auth check (admin only) ---
  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(data.user);
        if (data.user.role !== "admin") {
          setErr("Admins only");
        }
      })
      .catch(() => {
        window.location.href = "/teacher/login";
      });
  }, []);

  // --- Load class list ---
  useEffect(() => {
    if (!me) return;
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        const labels = (data.classes || []).map((c) => c.label);
        setClasses(labels);
        if (labels.length && !labels.includes(classLabel)) setClassLabel(labels[0]);
      })
      .catch(() => {});
  }, [me]);

  // --- Load pupils list for selected class ---
  async function loadPupils(selected = classLabel) {
    if (!canUsePage) return;
    setLoadingList(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(selected)}`);
      const data = await r.json();
      if (!data.ok) {
        setErr(data.error || "Failed to load pupils");
        setList([]);
      } else {
        setList(data.pupils || []);
      }
    } catch (e) {
      setErr("Failed to load pupils");
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!canUsePage) return;
    loadPupils(classLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePage, classLabel]);

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  // --- Clear a whole class (your existing endpoint) ---
  async function clearClass() {
    setMsg("");
    setErr("");
    if (!confirm(`Delete ALL pupils in ${classLabel}? This is permanent.`)) return;

    try {
      const r = await fetch("/api/admin/pupils/clear_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_label: classLabel }),
      });
      const data = await r.json();
      if (!data.ok) {
        setErr(data.error || "Failed to delete pupils");
      } else {
        setMsg(`Deleted pupils in ${classLabel} ✅`);
        await loadPupils(classLabel);
      }
    } catch (e) {
      setErr("Failed to delete pupils");
    }
  }

  // --- Bulk import (your existing endpoint) ---
  async function importCsv() {
    setMsg("");
    setErr("");
    setImportResult(null);

    try {
      const r = await fetch("/api/admin/pupils/bulk_import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await r.json();
      if (!data.ok) {
        setErr(data.error || "Import failed");
        return;
      }
      setImportResult(data);
      setMsg(`Imported ${data.created || 0} pupils ✅`);
      await loadPupils(classLabel);
    } catch (e) {
      setErr("Import failed");
    }
  }

  // --- Download usernames + PINs (uses the last importResult created list if available) ---
  function downloadPins() {
    if (!importResult?.created_rows?.length) return;

    const lines = [
      "class_label,first_name,last_name,username,pin",
      ...importResult.created_rows.map((r) =>
        [
          r.class_label || "",
          r.first_name || "",
          r.last_name || "",
          r.username || "",
          r.pin || "",
        ]
          .map((x) => String(x).replaceAll('"', '""'))
          .map((x) => `"${x}"`)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pupils_${classLabel}_usernames_pins.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- NEW: Reset PIN for one pupil ---
  async function resetPin(studentId) {
    setMsg("");
    setErr("");

    if (!confirm("Reset this pupil's PIN? You will need to copy the new PIN.")) return;

    try {
      const r = await fetch("/api/admin/pupils/reset_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await r.json();
      if (!data.ok) {
        setErr(data.error || "Failed to reset PIN");
        return;
      }

      // show PIN in a simple prompt so you can copy
      alert(`New PIN for ${data.student?.username || "pupil"} is: ${data.pin}`);
      setMsg("PIN reset ✅");
    } catch (e) {
      setErr("Failed to reset PIN");
    }
  }

  // --- NEW: Delete one pupil ---
  async function deletePupil(studentId) {
    setMsg("");
    setErr("");

    if (!confirm("Delete this pupil? This will also delete their attempts.")) return;

    try {
      const r = await fetch("/api/admin/pupils/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await r.json();
      if (!data.ok) {
        setErr(data.error || "Failed to delete pupil");
        return;
      }
      setMsg("Pupil deleted ✅");
      await loadPupils(classLabel);
    } catch (e) {
      setErr("Failed to delete pupil");
    }
  }

  if (!me) return null;

  return (
    <div style={{ padding: 30, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Manage Pupils</h1>
          <div style={{ color: "#666" }}>Admin area</div>
        </div>
        <button onClick={logout} style={{ padding: "10px 14px" }}>
          Log out
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/teacher">← Back to dashboard</Link>
      </div>

      {err && (
        <div style={{ marginTop: 16, padding: 12, background: "#ffe5e5", borderRadius: 10, color: "#a00" }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{ marginTop: 16, padding: 12, background: "#e6ffed", borderRadius: 10, color: "#046c2f" }}>
          {msg}
        </div>
      )}

      {!canUsePage && <p style={{ marginTop: 20, color: "crimson" }}>Admins only</p>}

      {canUsePage && (
        <>
          {/* Step 1 */}
          <section style={{ marginTop: 30, padding: 18, background: "#f6f7f8", borderRadius: 14 }}>
            <h2 style={{ marginTop: 0 }}>Step 1: Clear old test pupils (class-by-class)</h2>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label>
                Class:{" "}
                <select
                  value={classLabel}
                  onChange={(e) => setClassLabel(e.target.value)}
                  style={{ padding: 6, marginLeft: 6 }}
                >
                  {(classes.length ? classes : ["M4", "B3", "B4", "3M", "3B", "4M", "4B"]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={clearClass}
                style={{ padding: "8px 12px", border: "1px solid #d33", color: "#d33", background: "white" }}
              >
                Delete ALL pupils in this class
              </button>
            </div>
          </section>

          {/* Step 2 */}
          <section style={{ marginTop: 20, padding: 18, background: "#f6f7f8", borderRadius: 14 }}>
            <h2 style={{ marginTop: 0 }}>Step 2: Bulk import pupils</h2>
            <p style={{ marginTop: 6 }}>
              Paste CSV with headers: <b>class_label,first_name,last_name</b>
            </p>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              style={{ width: "100%", padding: 10, fontFamily: "monospace" }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={importCsv} style={{ padding: "10px 14px" }}>
                Import CSV
              </button>

              <button
                onClick={downloadPins}
                disabled={!importResult?.created_rows?.length}
                style={{ padding: "10px 14px" }}
              >
                Download usernames + PINs
              </button>
            </div>

            {importResult?.skipped?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <b>Skipped rows:</b>
                <ul>
                  {importResult.skipped.slice(0, 50).map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Step 3 */}
          <section style={{ marginTop: 20, padding: 18, background: "white", borderRadius: 14, border: "1px solid #eee" }}>
            <h2 style={{ marginTop: 0 }}>Pupils in {classLabel}</h2>

            {loadingList ? (
              <p>Loading…</p>
            ) : list.length === 0 ? (
              <p>No pupils found.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                    <th style={{ padding: "10px 6px" }}>Name</th>
                    <th style={{ padding: "10px 6px" }}>Username</th>
                    <th style={{ padding: "10px 6px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <b>{`${p.first_name || ""} ${p.last_name || ""}`.trim() || "(no name)"}</b>
                      </td>
                      <td style={{ padding: "10px 6px", fontFamily: "monospace" }}>{p.username || "—"}</td>
                      <td style={{ padding: "10px 6px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => resetPin(p.id)} style={{ padding: "8px 12px" }}>
                          Reset PIN
                        </button>
                        <button
                          onClick={() => deletePupil(p.id)}
                          style={{ padding: "8px 12px", border: "1px solid #d33", color: "#d33", background: "white" }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 10 }}>
              <button onClick={() => loadPupils(classLabel)} style={{ padding: "8px 12px" }}>
                Refresh list
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
