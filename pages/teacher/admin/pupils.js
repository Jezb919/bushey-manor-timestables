import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [csvText, setCsvText] = useState(
    "class_label,first_name,last_name\nM4,Bob,Bobness\n"
  );

  const [pupils, setPupils] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return (window.location.href = "/teacher/login");
        setMe(d.user);
        if (d.user.role !== "admin") window.location.href = "/teacher";
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Failed to load classes");
        setClasses(d.classes || []);
        if (!classLabel && d.classes?.[0]?.class_label) setClassLabel(d.classes[0].class_label);
      })
      .catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPupils(label) {
    const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(label)}`);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error + (d.debug ? ` (${d.debug})` : ""));
    setPupils(d.pupils || []);
  }

  useEffect(() => {
    if (!me || !classLabel) return;
    loadPupils(classLabel).catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, classLabel]);

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  async function bulkImport() {
    setError("");
    setSuccess("");
    setBulkResult(null);
    setImporting(true);

    try {
      const r = await fetch("/api/admin/pupils/bulk_import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText }),
      });

      const d = await r.json();
      if (!d.ok) throw new Error(d.error + (d.debug ? ` (${d.debug})` : ""));
      setBulkResult(d);
      setSuccess(`Imported ${d.created_count} pupils ✅ (skipped ${d.skipped_count}).`);
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }

    setImporting(false);
  }

  function downloadPins() {
    if (!bulkResult?.created?.length) return;
    const rows = [
      ["class_label", "first_name", "last_name", "username", "pin"],
      ...bulkResult.created.map((x) => [
        x.class_label, x.first_name, x.last_name, x.username, x.pin,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

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

  async function deleteWholeClass() {
    if (!confirm(`Delete ALL pupils in ${classLabel}? (This is class-by-class cleanup)`)) return;

    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/admin/pupils/delete_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_label: classLabel }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error + (d.debug ? ` (${d.debug})` : ""));
      setSuccess(`Deleted all pupils in ${classLabel} ✅`);
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  if (!me) return null;

  return (
    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1>Manage Pupils</h1>
          <div style={{ marginTop: 6 }}>
            <Link href="/teacher">← Back to dashboard</Link>
          </div>
        </div>
        <button onClick={logout}>Log out</button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fee", borderRadius: 10, color: "#900" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ marginTop: 16, padding: 12, background: "#efe", borderRadius: 10, color: "#060" }}>
          {success}
        </div>
      )}

      <div style={{ marginTop: 20, padding: 18, background: "#fff", borderRadius: 14 }}>
        <h2>Step 1: Clear old test pupils (class-by-class)</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

          <button
            onClick={deleteWholeClass}
            style={{ border: "1px solid #c00", color: "#c00", background: "white" }}
          >
            Delete ALL pupils in this class
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 18, background: "#fff", borderRadius: 14 }}>
        <h2>Step 2: Bulk import pupils</h2>

        <p style={{ marginTop: 6 }}>
          Paste CSV with headers: <b>class_label,first_name,last_name</b>
        </p>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={8}
          style={{ width: "100%", fontFamily: "monospace", marginTop: 10 }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={bulkImport} disabled={importing}>
            {importing ? "Importing..." : "Import CSV"}
          </button>

          <button onClick={downloadPins} disabled={!bulkResult?.created?.length}>
            Download usernames + PINs
          </button>
        </div>

        {bulkResult?.skipped?.length ? (
          <div style={{ marginTop: 12 }}>
            <b>Skipped rows:</b>
            <ul>
              {bulkResult.skipped.slice(0, 10).map((s, idx) => (
                <li key={idx}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 20, padding: 18, background: "#fff", borderRadius: 14 }}>
        <h2>Pupils in {classLabel}</h2>
        {!pupils.length ? (
          <p>No pupils found.</p>
        ) : (
          <ul>
            {pupils.map((p) => (
              <li key={p.id}>
                {p.first_name} {p.last_name || ""} — <b>{p.username}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
