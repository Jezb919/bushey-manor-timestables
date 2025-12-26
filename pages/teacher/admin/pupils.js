import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");

  const [pupils, setPupils] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [newCreds, setNewCreds] = useState(null);

  // --------- helpers ----------
  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  async function loadPupils(class_label) {
    setErr("");
    setMsg("");
    setNewCreds(null);

    // 1) Prefer admin list endpoint if you have it
    try {
      const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(class_label)}`);
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to load pupils");
      setPupils(j.pupils || []);
      return;
    } catch {
      // 2) Fallback: teacher students endpoint
      const r2 = await fetch("/api/teacher/students");
      const j2 = await safeJson(r2);
      if (!j2.ok) throw new Error(j2.error || "Failed to load pupils");
      const filtered = (j2.students || []).filter((s) => s.class_label === class_label);
      setPupils(filtered);
    }
  }

  // --------- load me + classes ----------
  useEffect(() => {
    (async () => {
      setErr("");
      setMsg("");
      try {
        const r = await fetch("/api/teacher/me");
        const j = await safeJson(r);

        // ✅ If not logged in OR user missing, go login
        if (!j.ok || !j.user) {
          window.location.href = "/teacher/login";
          return;
        }

        setMe(j.user);

        if (j.user.role !== "admin") {
          setErr("Admins only");
          return;
        }

        const cr = await fetch("/api/teacher/classes");
        const cj = await safeJson(cr);
        if (!cj.ok) throw new Error(cj.error || "Failed to load classes");

        const cls = cj.classes || [];
        setClasses(cls);

        const defaultLabel = cls[0]?.class_label || "M4";
        setSelectedClass(defaultLabel);

        // load pupils list
        await loadPupils(defaultLabel);
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------- change class ----------
  async function onChangeClass(e) {
    const v = e.target.value;
    setSelectedClass(v);
    try {
      await loadPupils(v);
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
  }

  // --------- logout ----------
  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  // --------- add pupil ----------
  async function addPupil() {
    setErr("");
    setMsg("");
    setNewCreds(null);

    try {
      if (!selectedClass) throw new Error("Pick a class first");
      if (!firstName.trim()) throw new Error("Enter first name");
      if (!surname.trim()) throw new Error("Enter surname");

      const body = {
        class_label: selectedClass, // ✅ IMPORTANT
        first_name: firstName,
        surname: surname,
      };

      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to create pupil");

      setMsg(`Added ${j.pupil?.first_name} ${j.pupil?.surname} to ${j.pupil?.class_label} ✅`);
      setNewCreds(j.credentials || null);

      setFirstName("");
      setSurname("");

      await loadPupils(selectedClass);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  const classOptions = useMemo(() => classes.map((c) => c.class_label), [classes]);

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={{ margin: 0 }}>Pupils</h1>
          <div style={{ opacity: 0.7 }}>Admin area</div>
          <div style={{ marginTop: 8 }}>
            <Link href="/teacher/dashboard">← Back to dashboard</Link>
          </div>
        </div>
        <button onClick={logout} style={btn}>
          Log out
        </button>
      </div>

      {err && <div style={errorBox}>{err}</div>}
      {msg && <div style={okBox}>{msg}</div>}

      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Add pupil to {selectedClass || "…"}</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedClass} onChange={onChangeClass} style={input}>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          <input
            style={input}
            placeholder="Surname"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />

          <button onClick={addPupil} style={btnPrimary}>
            Add pupil
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
          After creating a pupil, you’ll see their username + temporary password (copy it straight away).
        </div>

        {newCreds && (
          <div style={credsBox}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>New pupil login</div>
            <div>
              <b>Username:</b> {newCreds.username}
            </div>
            <div>
              <b>Temp password:</b> {newCreds.tempPassword}
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Pupils in {selectedClass || "…"}</h2>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Username</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pupils.map((p) => {
              const name = `${p.first_name || ""} ${p.surname || ""}`.trim() || "(no name)";
              return (
                <tr key={p.id}>
                  <td style={td}>{name}</td>
                  <td style={td}>{p.username || "—"}</td>
                  <td style={td}>
                    <button
                      style={btnSmall}
                      onClick={() => (window.location.href = `/teacher/admin/pupil/${p.id}`)}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              );
            })}

            {!pupils.length && (
              <tr>
                <td style={td} colSpan={3}>
                  No pupils found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
          Note: older pupils show “null” surname until you add surnames to their records.
        </div>
      </div>
    </div>
  );
}

/* styles */
const page = { padding: 24, background: "#f3f4f6", minHeight: "100vh" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };
const card = {
  background: "white",
  borderRadius: 14,
  padding: 18,
  marginTop: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
};
const input = { padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" };
const btn = { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", background: "white", fontWeight: 900 };
const btnPrimary = { ...btn, background: "#0f172a", color: "white", border: "1px solid #0f172a" };
const btnSmall = { padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", background: "white", fontWeight: 900 };
const errorBox = { marginTop: 14, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 900 };
const okBox = { marginTop: 14, padding: 10, borderRadius: 10, background: "#dcfce7", color: "#166534", fontWeight: 900 };
const credsBox = { marginTop: 12, padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa" };

const table = { width: "100%", borderCollapse: "collapse", marginTop: 10 };
const th = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.1)", opacity: 0.7, fontSize: 12 };
const td = { padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
