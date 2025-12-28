// pages/teacher/admin/pupils.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function ManagePupils() {
  const [me, setMe] = useState(null);
  const [classLabel, setClassLabel] = useState("M4");
  const [classes, setClasses] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [search, setSearch] = useState("");
  const [csvText, setCsvText] = useState("class_label,first_name,last_name\n");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) window.location.href = "/teacher/login";
        else setMe(data.user);
      });
  }, []);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setClasses(data.classes || []);
      });
  }, []);

  async function load() {
    setMessage("");
    const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(classLabel)}`);
    const data = await r.json();
    if (!data.ok) setMessage(data.error || "Failed to load pupils");
    else setPupils(data.pupils || []);
  }

  useEffect(() => {
    if (me?.role === "admin") load();
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

  async function bulkImport() {
    setMessage("");
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
    await load();
  }

  if (!me) return null;
  if (me.role !== "admin") return <div style={{ padding: 30 }}>Admins only.</div>;

  return (
    <div style={{ padding: 30 }}>
      <h1>Manage Pupils</h1>
      <p>
        Logged in as <b>{me.email}</b> ({me.role})
      </p>

      <p>
        <Link href="/teacher">← Back to dashboard</Link>
      </p>

      {message && (
        <div style={{ background: "#fee", border: "1px solid #f99", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label>
          Class{" "}
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
            {classes.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
            {/* fallback if classes list empty */}
            {classes.length === 0 && (
              <>
                <option value="M4">M4</option>
                <option value="B4">B4</option>
                <option value="B3">B3</option>
              </>
            )}
          </select>
        </label>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pupil name or username…"
          style={{ width: 320, padding: 8 }}
        />

        <button onClick={load}>Refresh</button>
      </div>

      <h2>Bulk import pupils</h2>
      <p>
        Paste CSV with headers exactly: <b>class_label,first_name,last_name</b>
      </p>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        style={{ width: "100%", height: 160, fontFamily: "monospace" }}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={bulkImport}>Import CSV</button>
      </div>

      <h2 style={{ marginTop: 28 }}>Pupils in {classLabel}</h2>
      {filtered.length === 0 ? (
        <p>No pupils found.</p>
      ) : (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Name</th>
              <th>Username</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>
                  {(p.first_name || "") + " " + (p.last_name || "")}
                </td>
                <td style={{ fontFamily: "monospace" }}>{p.username}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
