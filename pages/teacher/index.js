import { useEffect, useState } from "react";
import Link from "next/link";

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setUser(data.user);
      })
      .catch(() => {
        window.location.href = "/teacher/login";
      });
  }, []);

  async function logout() {
    try {
      await fetch("/api/teacher/logout", { method: "POST" });
    } finally {
      window.location.href = "/teacher/login";
    }
  }

  if (!user) return null;

  return (
    <div style={{ padding: 30, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>
        {user.role === "admin" ? "Admin Dashboard" : "Teacher Dashboard"}
      </h1>

      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Logged in as <b>{user.email}</b> ({user.role})
      </p>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Teaching tools</h2>

        <div style={{ display: "grid", gap: 10 }}>
          <Link href="/teacher/class-overview">📋 Class overview</Link>
          <Link href="/teacher/class-settings">
            ⚙️ Class settings (questions + timer)
          </Link>
          <Link href="/teacher/attainment-individual">📈 Individual graphs</Link>
          <Link href="/teacher/attainment-class">📊 Class graphs</Link>
        </div>
      </div>

      {user.role === "admin" && (
        <div
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Admin tools</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <Link href="/teacher/admin/teachers">👩‍🏫 Manage teachers</Link>
            <Link href="/teacher/admin/pupils">👧 Manage pupils</Link>
          </div>
        </div>
      )}

      <button
        onClick={logout}
        style={{
          padding: "10px 16px",
          borderRadius: 12,
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        Log out
      </button>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
    </div>
  );
}
