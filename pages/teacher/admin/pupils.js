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

  const [csvText, setCsvText] = useState("class_label,first_name,last_name\n");
  const [lastImportCreated, setLastImportCreated] = useState([]); // [{full_name, username, pin, class_label}]
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canDownloadPins = useMemo(() => lastImportCreated?.length > 0, [lastImportCreated]);

  useEffect(() => {
    // confirm teacher/admin session
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        // only admins can be here
        if (data.user?.role !== "admin") {
          window.location.href = "/teacher";
          return;
        }
        setMe(data.user);
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  useEffect(() => {
    // load classes list (fallback if endpoint not present)
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.classes) && data.classes.length) {
          const labels = data.classes.map((c) => c.class_label).filter(Boolean);
          setClasses(labels);
          if (labels.includes(classLabel) === false) setClassLabel(labels[0]);
        } else {
          // fallback list if your endpoint returns something else
          setClasses(["3M", "3B", "4M", "4B", "M4", "B4", "B3", "M3"]);
        }
      })
      .catch(() => setClasses(["3M", "3B", "4M", "4B", "M4", "B4", "B3", "M3"]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!me) return;
    loadPupils();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, classLabel]);

  async function loadPupils() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(classLabel)}`);
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Failed to load pupils");
        setPupils([]);
        return;
      }
      setPupils(Array.isArray(data.pupils) ? data.pupils : []);
    } catch (e) {
      setError("Failed to load pupils");
      setPupils([]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/teacher/logout", { method: "POST" });
    } catch {}
    window.location.href = "/teacher/login";
  }

  async function addPupil(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLastImportCreated([]);

    const fn = (firstName || "").trim();
    const ln = (lastName || "").trim();
    if (!fn) {
      setError("First name is required");
      return;
    }

    try {
      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_label: classLabel,
          first_name: fn,
          last_name: ln || null,
        }),
      });
      const data = await r.json();

      if (!data.ok) {
        setError(data.error || "Failed to add pupil");
        return;
      }

      // try multiple possible response shapes
      const created = data.pupil || data.student || data.created || null;
      const username = data.username || created?.username;
      const pin = data.pin || data.new_pin || data.temp_pin || created?.pin;

      if (username && pin) {
        alert(`✅ Created\n\nUsername: ${username}\nPIN: ${pin}\n\nCopy this now.`);
      } else {
        alert("✅ Pupil created (but the API didn’t return username+PIN).");
      }

      setFirstName("");
      setLastName("");
      await loadPupils();
    } catch (e) {
      setError("Failed to add pupil");
    }
  }

  async function resetPin(p) {
    setError("");
    setNotice("");
    setLastImportCreated([]);

    if (!confirm("Reset this pupil's PIN? You will need to copy the new PIN.")) return;

    // IMPORTANT: we send several keys to match whatever your API expects
    const payload = {
      student_id: p.id,
      pupil_id: p.id,
      id: p.id,
      username: p.username,
    };

    try {
      const r = await fetch("/api/admin/pupils/reset_pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data.ok) {
        setError(data.error || `Failed to reset PIN`);
        return;
      }

      const newPin = data.pin || data.new_pin || data.temp_pin || data.newPIN;
      if (newPin) {
        alert(`✅ New PIN: ${newPin}\n\nCopy it now.`);
      } else {
        alert("✅ PIN reset, but the API did not return the new PIN.");
      }

      await loadPupils();
    } catch (e) {
      setError("Failed to reset PIN");
    }
  }

  async function deletePupil(p) {
    setError("");
    setNotice("");
    setLastImportCreated([]);

    if (!confirm(`Delete pupil ${p.first_name || ""} ${p.last_name || ""} (${p.username})?`)) return;

    try {
      const r = await fetch("/api/admin/pupils/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: p.id,
          pupil_id: p.id,
          id: p.id,
          username: p.username,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setError(data.error || "Failed to delete pupil");
        return;
      }
      setNotice("Deleted ✅");
      await loadPupils();
    } catch (e) {
      setError("Failed to delete pupil");
    }
  }

  async function deleteAllInClass() {
    setError("");
    setNotice("");
    setLastImportCreated([]);

    if (
      !confirm(
        `Delete ALL pupils in ${classLabel}?\n\nIf any have attempts, deletion may fail unless your DB is set to cascade deletes.`
      )
    )
      return;

    try {
      const r = await fetch("/api/admin/pupils/delete_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_label: classLabel }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setError(data.error || "Failed to delete pupils in class");
        return;
      }
      setNotice(`Deleted pupils in ${classLabel} ✅`);
      await loadPupils();
    } catch (e) {
      setError("Failed to delete pupils in class");
    }
  }

  async function importCsv() {
    setError("");
    setNotice("");
    setLastImportCreated([]);

    const text = (csvText || "").trim();
    if (!text) {
      setError("Paste CSV first");
      return;
    }

    // quick header check (you told me your app expects these headers)
    const firstLine = text.split(/\r?\n/)[0].trim();
    if (firstLine !== "class_label,first_name,last_name") {
      setError("CSV must have headers: class_label,first_name,last_name");
      return;
    }

    try {
      const r = await fetch("/api/admin/pupils/bulk_import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data.ok) {
        setError(data.error || "Bulk import failed");
        return;
      }

      // Expecting something like: { created: [{class_label, full_name, username, pin}] }
      const created = Array.isArray(data.created) ? data.created : [];
      setLastImportCreated(created);

      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      if (skipped.length) {
        setNotice(`Imported ✅ (some rows skipped: ${skipped.length})`);
      } else {
        setNotice("Imported ✅");
      }

      await loadPupils();
    } catch (e) {
      setError("Bulk import failed");
    }
  }

  function downloadPins() {
    if (!canDownloadPins) return;

    // Create a CSV file for download
    const lines = ["class_label,full_name,username,pin"];
    for (const row of lastImportCreated) {
      const cl = (row.class_label || "").replaceAll('"', '""');
      const name = (row.full_name || row.name || "").replaceAll('"', '""');
      const u = (row.username || "").replaceAll('"', '""');
      const pin = String(row.pin ?? row.new_pin ?? "").replaceAll('"', '""');
      lines.push(`"${cl}","${name}","${u}","${pin}"`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `usernames_pins_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!me) return null;

  return (
    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0 }}>Manage Pupils</h1>
          <p style={{ marginTop: 0, opacity: 0.8 }}>Admin area</p>
          <p style={{ marginTop: 0 }}>
            <Link href="/teacher">← Back to dashboard</Link>
          </p>
        </div>

        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 10 }}>
          Log out
        </button>
      </div>

      {error && (
        <div style={{ background: "#ffe5e5", color: "#9b1c1c", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: "#e8fff0", color: "#065f46", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {notice}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <b>Class:</b>{" "}
        <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {classes.includes("M4") === false && <option value="M4">M4</option>}
        </select>

        <button onClick={loadPupils} style={{ padding: "6px 10px", borderRadius: 8 }}>
          Refresh
        </button>

        <button
          onClick={deleteAllInClass}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #b91c1c",
            color: "#b91c1c",
            background: "white",
          }}
        >
          Delete ALL pupils in this class
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <h2 style={{ marginTop: 0 }}>Add pupil to {classLabel}</h2>

        <form onSubmit={addPupil} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            style={{ padding: 10, minWidth: 180 }}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Surname"
            style={{ padding: 10, minWidth: 180 }}
          />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10 }}>
            Add pupil
          </button>
        </form>

        <p style={{ marginBottom: 0, opacity: 0.8 }}>
          After creating a pupil, you’ll see their <b>username</b> and <b>PIN</b> (copy it straight away).
        </p>
      </div>

      <div style={{ height: 20 }} />

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <h2 style={{ marginTop: 0 }}>Bulk import pupils</h2>
        <p style={{ marginTop: 0 }}>
          Paste CSV with headers: <b>class_label,first_name,last_name</b>
        </p>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={10}
          style={{ width: "100%", padding: 12, fontFamily: "monospace" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <button onClick={importCsv} style={{ padding: "8px 12px", borderRadius: 10 }}>
            Import CSV
          </button>

          <button
            onClick={downloadPins}
            disabled={!canDownloadPins}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              opacity: canDownloadPins ? 1 : 0.5,
            }}
          >
            Download usernames + PINs
          </button>

          {canDownloadPins && <span style={{ opacity: 0.8 }}>{lastImportCreated.length} created</span>}
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <h2 style={{ marginTop: 0 }}>Pupils in {classLabel}</h2>

        {loading ? (
          <p>Loading…</p>
        ) : pupils.length === 0 ? (
          <p>No pupils found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Username</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                  <td style={{ padding: "10px 8px" }}>
                    <b>
                      {(p.first_name || "").trim()} {(p.last_name || "").trim()}
                    </b>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{p.username}</td>
                  <td style={{ padding: "10px 8px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => resetPin(p)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                      Reset PIN
                    </button>
                    <button
                      onClick={() => deletePupil(p)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid #b91c1c",
                        color: "#b91c1c",
                        background: "white",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ marginBottom: 0, marginTop: 12, opacity: 0.7 }}>
          Note: older pupils may show blank surname until you add it.
        </p>
      </div>
    </div>
  );
}
