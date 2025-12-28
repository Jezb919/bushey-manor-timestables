import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [pupils, setPupils] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Bulk import
  const [csvText, setCsvText] = useState("class_label,first_name,last_name\nM4,Bob,Bobness\n");
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(d.user);
        if (d.user.role !== "admin") {
          window.location.href = "/teacher";
        }
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Failed to load classes");
        setClasses(d.classes || []);
        if ((d.classes || []).length && !classLabel) setClassLabel(d.classes[0].class_label);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPupils(label) {
    setError("");
    const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(label)}`);
    const d = await r.json();
    if (!d.ok) {
      setError(d.error || "Failed to load pupils");
      return;
    }
    setPupils(d.pupils || []);
  }

  useEffect(() => {
    if (classLabel) loadPupils(classLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLabel]);

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  async function addPupil(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBulkResult(null);

    const r = await fetch("/api/admin/pupils/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_label: classLabel,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    const d = await r.json();
    if (!d.ok) {
      setError(d.error || "Failed to add pupil");
      return;
    }

    setSuccess(`Created: ${d.pupil?.username} (PIN: ${d.pin}) ✅  Copy it now.`);
    setFirstName("");
    setLastName("");
    await loadPupils(classLabel);
  }

  async function deletePupil(pupilId) {
    if (!confirm("Delete this pupil? This also deletes their attempts.")) return;
    setError("");
    setSuccess("");
    setBulkResult(null);

    const r = await fetch("/api/admin/pupils/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupil_id: pupilId }),
    });
    const d = await r.json();
    if (!d.ok) {
      setError(d.error || "Failed to delete pupil");
      return;
    }
    setSuccess("Deleted ✅");
    await loadPupils(classLabel);
  }

  async function bulkImport() {
    setError("");
    setSuccess("");
    setBulkResult(null);

    const r = await fetch("/api/admin/pupils/bulk_import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: csvText }),
    });

    const d = await r.json();
    if (!d.ok) {
      setError(d.error || "Bulk import failed");
      return;
    }

    setBulkResult(d);
    setSuccess(`Imported ${d.created_count} pupils ✅ (skipped ${d.skipped_count}).`);
    await loadPupils(classLabel);
  }

  function downloadPins() {
    if (!bulkResult?.created?.length) return;
    const rows = [
      ["class_label", "first_name", "last_name", "username", "pin"],
      ...bulkResult.created.map((x) => [
        x.class_label,
        x.first_name,
        x.last_name || "",
        x.username,
        x.pin,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pupil_logins.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!me) return null;

  return (
    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Pupils</h1>
          <div>Admin area</div>
          <div style={{ marginTop: 8 }}>
            <Link href="/teacher">← Back to dashboard</Link>
          </div>
        </div>
        <button onClick={logout}>Log out</button>
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: 12, background: "#fee", borderRadius: 8, color: "#900" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginTop: 20, padding: 12, background: "#efe", borderRadius: 8, color: "#060" }}>
          {success}
        </div>
      )}

      {/* Bulk import */}
      <div style={{ marginTop: 20, padding: 20, background: "#fff", borderRadius: 12 }}>
        <h2>Bulk import (all classes)</h2>
        <p style={{ marginTop: 6 }}>
          Paste a CSV with headers: <b>class_label,first_name,last_name</b>. It will generate <b>username + PIN</b> for each pupil.
        </p>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          style={{ width: "100%", marginTop: 10, fontFamily: "monospace" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={bulkImport}>Import CSV</button>
          <button onClick={downloadPins} disabled={!bulkResult?.created?.length}>
            Download usernames + PINs
          </button>
        </div>

        {bulkResult?.skipped?.length ? (
          <div style={{ marginTop: 12 }}>
            <b>Skipped rows:</b>
            <ul>
              {bulkResult.skipped.slice(0, 8).map((s, idx) => (
                <li key={idx}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
            {bulkResult.skipped.length > 8 && <div>…and more</div>}
          </div>
        ) : null}
      </div>

      {/* Class picker + add pupil */}
      <div style={{ marginTop: 20, padding: 20, background: "#fff", borderRadius: 12 }}>
        <h2>Add pupil to {classLabel || "…"}</h2>

        <div style={{ marginBottom: 10 }}>
          <label>
            Class:&nbsp;
            <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.class_label}>
                  {c.class_label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form onSubmit={addPupil} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
            style={{ minWidth: 200 }}
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Surname"
            style={{ minWidth: 200 }}
          />
          <button type="submit">Add pupil</button>
        </form>

        <p style={{ marginTop: 8 }}>
          After creating a pupil, you’ll see their <b>username</b> and <b>PIN</b> (copy it straight away).
        </p>
      </div>

      {/* Pupils list */}
      <div style={{ marginTop: 20, padding: 20, background: "#fff", borderRadius: 12 }}>
        <h2>Pupils in {classLabel}</h2>

        {!pupils.length ? (
          <p>No pupils found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 10 }}>Name</th>
                <th style={{ padding: 10 }}>Username</th>
                <th style={{ padding: 10 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>
                    {p.first_name} {p.last_name || ""}
                  </td>
                  <td style={{ padding: 10 }}>{p.username}</td>
                  <td style={{ padding: 10 }}>
                    <button onClick={() => deletePupil(p.id)} style={{ border: "1px solid #c00", color: "#c00" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 10, color: "#666" }}>
          Note: older pupils may show blank surname until you add it.
        </div>
      </div>
    </div>
  );
}
