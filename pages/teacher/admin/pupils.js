import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function AdminPupilsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("M4");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");

  const [pupils, setPupils] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [newCreds, setNewCreds] = useState(null);

  // ---------- load logged-in user + classes ----------
  useEffect(() => {
    (async () => {
      setErr("");
      setMsg("");
      try {
        const r = await fetch("/api/teacher/me");
        const j = await r.json();
        if (!j.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(j.user);
        if (j.user.role !== "admin") {
          setErr("Admins only");
          return;
        }

        const cr = await fetch("/api/teacher/classes");
        const cj = await cr.json();
        if (!cj.ok) throw new Error(cj.error || "Failed to load classes");

        setClasses(cj.classes || []);
        if (cj.classes?.length) {
          setSelectedClass(cj.classes[0].class_label);
        }
      } catch (e) {
        setErr(String(e.message || e));
      }
    })();
  }, []);

  // ---------- load pupils for selected class ----------
  async function loadPupils(class_label) {
    setErr("");
    setMsg("");
    setNewCreds(null);

    try {
      // You may already have an endpoint for this; if not, this will be the only thing to adjust.
      const r = await fetch(`/api/admin/pupils/list?class_label=${encodeURIComponent(class_label)}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load pupils");
      setPupils(j.pupils || []);
    } catch (e) {
      // fallback: use /api/teacher/students and filter client-side
      try {
        const r2 = await fetch("/api/teacher/students");
        const j2 = await r2.json();
        if (!j2.ok) throw new Error(j2.error || "Failed to load pupils");
        const filtered = (j2.students || []).filter((s) => s.class_label === class_label);
        setPupils(filtered);
      } catch (e2) {
        setErr(String(e2.message || e2));
      }
    }
  }

  useEffect(() => {
    if (me?.role === "admin" && selectedClass) {
      loadPupils(selectedClass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, me?.role]);

  // ---------- logout ----------
  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  // ---------- add pupil ----------
  async function addPupil() {
    setErr("");
    setMsg("");
    setNewCreds(null);

    try {
      const body = {
        // ✅ IMPORTANT: API expects class_label (NOT class, NOT classId)
        class_label: selectedClass,
        first_name: firstName,
        surname: surname,
      };

      const r = await fetch("/api/admin/pupils/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = await r.json();
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

  // ---------- UI ----------
  const classOptions = useMemo(() => classes.map((c) => c.class_label), [classes]);

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={{ margin: 0 }}>Pupils</h1>
          <div style={{ opacity: 0.7 }}>Admin area</div>
        </div>
        <button onClick={logout} style={btn}>
          Log out
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/teacher/dashboard">← Back to dashboard</Link>
      </div>

      {err && <div style={errorBox}>{err}</div>}
      {msg && <div style={okBox}>{msg}</div>}

      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Add pupil to {selectedClass}</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={input}
          >
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
        <h2 style={{ marginTop: 0 }}>Pupils in {selectedClass}</h2>

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
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center" };
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
