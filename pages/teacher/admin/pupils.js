import { useEffect, useState } from "react";
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

  async function loadMe() {
    const r = await fetch("/api/teacher/me");
    const j = await r.json();
    if (!j.ok) {
      window.location.href = "/teacher/login";
      return;
    }
    setMe(j.user);
    if (j.user.role !== "admin") {
      setError("Admins only");
    }
  }

  async function loadClasses() {
    const r = await fetch("/api/teacher/classes");
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Failed to load classes");
    setClasses(j.classes || []);
    if (!classLabel && j.classes?.[0]?.class_label) setClassLabel(j.classes[0].class_label);
  }

  async function loadPupils(label) {
    setError("");
    const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(label)}`);
    const j = await r.json();
    if (!j.ok) {
      setPupils([]);
      throw new Error(j.error + (j.debug ? ` (${j.debug})` : ""));
    }
    setPupils(j.pupils || []);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadMe();
        await loadClasses();
      } catch (e) {
        setError(String(e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!me) return;
    if (me.role !== "admin") return;
    if (!classLabel) return;

    (async () => {
      try {
        await loadPupils(classLabel);
      } catch (e) {
        setError(String(e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, classLabel]);

  async function addPupil() {
    setError("");
    setSuccess("");

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
      const j = await r.json();

      if (!j.ok) {
        throw new Error(j.error + (j.debug ? ` (${j.debug})` : ""));
      }

      setSuccess(`Created: ${j.pupil.username} — PIN: ${j.pin} ✅  (copy this now!)`);
      setFirstName("");
      setLastName("");
      await loadPupils(classLabel);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  if (!me) return null;

  return (
    <div style={{ padding: 30 }}>
      <h1>Pupils</h1>
      <div style={{ marginBottom: 10, color: "#666" }}>Admin area</div>

      <Link href="/teacher">← Back to dashboard</Link>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#ffe5e5", borderRadius: 10, color: "#900" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ marginTop: 16, padding: 12, background: "#e8fff0", borderRadius: 10, color: "#065f46" }}>
          {success}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2>Add pupil to {classLabel}</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.class_label}>
                {c.class_label}
              </option>
            ))}
          </select>

          <input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ width: 220 }}
          />

          <input
            placeholder="Surname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ width: 220 }}
          />

          <button onClick={addPupil}>Add pupil</button>
        </div>

        <p style={{ marginTop: 10, color: "#666" }}>
          After creating a pupil, you’ll see their <b>username</b> and <b>PIN</b> (copy it straight away).
        </p>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Pupils in {classLabel}</h2>

        {pupils.length === 0 ? (
          <p>No pupils found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 10 }}>Name</th>
                <th style={{ padding: 10 }}>Username</th>
              </tr>
            </thead>
            <tbody>
              {pupils.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 10 }}>
                    {(p.first_name || "") + " " + (p.last_name || "")}
                  </td>
                  <td style={{ padding: 10 }}>{p.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p style={{ marginTop: 10, color: "#777" }}>
          Note: older pupils may show blank surname until you add it.
        </p>
      </div>
    </div>
  );
}
