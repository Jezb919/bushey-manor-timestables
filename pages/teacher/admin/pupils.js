import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupils() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("");
  const [pupils, setPupils] = useState([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.class_label === classLabel),
    [classes, classLabel]
  );

  useEffect(() => {
    // Load me (admin check)
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(d.user);
      })
      .catch(() => window.location.href = "/teacher/login");
  }, []);

  useEffect(() => {
    // Load classes list (for dropdown)
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setClasses(d.classes || []);
        if ((d.classes || []).length && !classLabel) {
          setClassLabel(d.classes[0].class_label);
        }
      });
  }, []);

  useEffect(() => {
    if (!classLabel) return;
    setErr("");
    setMsg("");

    fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(classLabel)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setErr(d.error || "Failed to load pupils");
          setPupils([]);
          return;
        }
        setPupils(d.pupils || []);
      })
      .catch(() => {
        setErr("Failed to load pupils");
        setPupils([]);
      });
  }, [classLabel]);

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  async function addPupil() {
    setErr("");
    setMsg("");
    setBusy(true);

    try {
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
        setErr(d.error || "Failed to add pupil");
        setBusy(false);
        return;
      }

      const p = d.pupil;
      setMsg(
        `Created: ${p.first_name} ${p.last_name} (${p.class_label}) — Username: ${p.username} — PIN: ${p.pin}`
      );

      setFirstName("");
      setLastName("");

      // refresh list
      const rr = await fetch(
        `/api/admin/pupils/list?class_label=${encodeURIComponent(classLabel)}`
      );
      const dd = await rr.json();
      if (dd.ok) setPupils(dd.pupils || []);
    } catch (e) {
      setErr("Failed to add pupil");
    }

    setBusy(false);
  }

  async function deletePupil(id) {
    if (!confirm("Delete this pupil?")) return;
    setErr("");
    setMsg("");

    const r = await fetch("/api/admin/pupils/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const d = await r.json();
    if (!d.ok) {
      setErr(d.error || "Failed to delete pupil");
      return;
    }
    setMsg("Pupil deleted ✅");

    setPupils((prev) => prev.filter((p) => p.id !== id));
  }

  if (!me) return null;

  if (me.role !== "admin") {
    return (
      <div style={{ padding: 30 }}>
        <h1>Pupils</h1>
        <p style={{ color: "red" }}>Admins only</p>
        <button onClick={logout}>Log out</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 30 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>Pupils</h1>
          <p>Admin area</p>
          <p>
            <Link href="/teacher">← Back to dashboard</Link>
          </p>
        </div>
        <button onClick={logout} style={{ padding: "10px 14px" }}>Log out</button>
      </div>

      {err && (
        <div style={{ background: "#ffe5e5", padding: 12, borderRadius: 10, marginBottom: 14 }}>
          <b style={{ color: "#b00020" }}>{err}</b>
        </div>
      )}

      {msg && (
        <div style={{ background: "#e8fff1", padding: 12, borderRadius: 10, marginBottom: 14 }}>
          <b style={{ color: "#0a7a2f" }}>{msg}</b>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Add pupil to {classLabel || "(choose class)"}</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.class_label}>
                {c.class_label}
              </option>
            ))}
          </select>

          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            style={{ padding: 10, minWidth: 220 }}
          />

          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Surname"
            style={{ padding: 10, minWidth: 220 }}
          />

          <button disabled={busy} onClick={addPupil} style={{ padding: "10px 14px" }}>
            {busy ? "Adding..." : "Add pupil"}
          </button>
        </div>

        <p style={{ marginTop: 10, opacity: 0.8 }}>
          After creating a pupil, you’ll see their <b>username</b> and <b>PIN</b> (copy it straight away).
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Pupils in {classLabel}</h2>

        {!pupils.length ? (
          <p>No pupils found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "10px 6px" }}>Name</th>
                <th style={{ padding: "10px 6px" }}>Username</th>
                <th style={{ padding: "10px 6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => {
                const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "(no name)";
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: "12px 6px" }}>{fullName}</td>
                    <td style={{ padding: "12px 6px" }}>{p.username || "—"}</td>
                    <td style={{ padding: "12px 6px", display: "flex", gap: 10 }}>
                      <button
                        onClick={() => (window.location.href = `/teacher/pupil/${p.id}`)}
                        style={{ padding: "8px 12px" }}
                      >
                        Manage
                      </button>

                      <button
                        onClick={() => deletePupil(p.id)}
                        style={{
                          padding: "8px 12px",
                          border: "1px solid #c40000",
                          color: "#c40000",
                          borderRadius: 10,
                          background: "white",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p style={{ marginTop: 12, opacity: 0.7 }}>
          Note: older pupils may show blank surname until you add it.
        </p>
      </div>
    </div>
  );
}
