import { useEffect, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

export async function getServerSideProps(context) {
  const raw = context.req.cookies?.bmtt_teacher;
  if (!raw) return { redirect: { destination: "/teacher/login", permanent: false } };

  try {
    const s = JSON.parse(raw);
    // only admins allowed
    if (s.role !== "admin") {
      return { redirect: { destination: "/teacher/dashboard", permanent: false } };
    }
  } catch {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }

  return { props: {} };
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Bad response from server", debug: text?.slice(0, 120) || "" };
  }
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTeachers() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/teachers/list");
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to load teachers");
      setTeachers(j.teachers || []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeachers();
  }, []);

  async function setRoleFor(teacher_id, newRole, emailAddr) {
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/teachers/set_role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id, role: newRole }),
      });
      const j = await safeJson(r);
      if (!j.ok) throw new Error(j.error || "Failed to update role");
      setMsg(`Updated ${emailAddr} → ${newRole} ✅`);
      await loadTeachers();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <AdminHeader title="Teachers" />

        {err && <div style={{ color: "#b91c1c", fontWeight: 900, marginTop: 10 }}>{err}</div>}
        {msg && <div style={{ color: "#166534", fontWeight: 900, marginTop: 10 }}>{msg}</div>}

        <div style={card}>
          {loading ? (
            <div style={{ padding: 10 }}>Loading…</div>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={thRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td style={tdStrong}>{t.full_name || "—"}</td>
                    <td style={tdMono}>{t.email}</td>
                    <td style={tdRole}>{t.role}</td>
                    <td style={tdRight}>
                      {t.role === "admin" ? (
                        <button style={btn} onClick={() => setRoleFor(t.id, "teacher", t.email)}>
                          Make teacher
                        </button>
                      ) : (
                        <button style={btn} onClick={() => setRoleFor(t.id, "admin", t.email)}>
                          Make admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!teachers.length && (
                  <tr>
                    <td style={td} colSpan={4}>No teachers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
  marginTop: 16,
};

const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, opacity: 0.7, borderBottom: "1px solid rgba(0,0,0,0.1)" };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
const tdStrong = { ...td, fontWeight: 900 };
const tdMono = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const tdRole = { ...td, fontWeight: 900, textTransform: "lowercase" };
const tdRight = { ...td, textAlign: "right" };
const btn = { padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", fontWeight: 900, cursor: "pointer" };
