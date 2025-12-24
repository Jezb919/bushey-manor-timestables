import { useEffect, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

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
      const j = await r.json();
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

  async function setRole(teacher_id, role, email) {
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/teachers/set_role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id, role }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to update role");

      setMsg(`Updated ${email} → ${role} ✅`);
      await loadTeachers();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <AdminHeader title="Teachers" />

        {err && <div style={{ color: "red", fontWeight: 700 }}>{err}</div>}
        {msg && <div style={{ color: "green", fontWeight: 700 }}>{msg}</div>}

        <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginTop: 16 }}>
          {loading ? (
            <div>Loading teachers…</div>
          ) : (
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td>{t.full_name || "—"}</td>
                    <td>{t.email}</td>
                    <td><b>{t.role}</b></td>
                    <td>
                      {t.role === "admin" ? (
                        <button onClick={() => setRole(t.id, "teacher", t.email)}>
                          Make teacher
                        </button>
                      ) : (
                        <button onClick={() => setRole(t.id, "admin", t.email)}>
                          Make admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!teachers.length && (
                  <tr>
                    <td colSpan={4}>No teachers found.</td>
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
