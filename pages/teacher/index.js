import { useEffect, useState } from "react";
import Link from "next/link";

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);

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
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  async function logout() {
    try {
      await fetch("/api/teacher/logout", { method: "POST" });
    } finally {
      window.location.href = "/teacher/login";
    }
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <div style={{ padding: 28, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>
        {isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}
      </h1>

      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Logged in as <b>{user.email}</b> ({user.role})
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          Log out
        </button>

        {/* If you ever need the admin landing page */}
        {isAdmin && (
          <Link
            href="/teacher/admin"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Admin Home
          </Link>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Teacher tools</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <Link href="/teacher/class-overview">Class overview</Link>
          </li>
          <li>
            <Link href="/teacher/class-settings">
              Class settings (questions + timer + start date)
            </Link>
          </li>
          <li>
            <Link href="/teacher/attainment-individual">Individual graphs</Link>
          </li>
          <li>
            <Link href="/teacher/attainment-class">Class graphs</Link>
          </li>
        </ul>
      </div>

      {isAdmin && (
        <div
          style={{
            marginTop: 18,
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Admin tools</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <Link href="/teacher/admin/teachers">Manage teachers</Link>
            </li>
            <li>
              <Link href="/teacher/admin/pupils">Manage pupils</Link>
            </li>
          </ul>

          <p style={{ marginTop: 10, opacity: 0.75 }}>
            Admin can see all classes in Class Overview. Teachers see only their class.
          </p>
        </div>
      )}
    </div>
  );
}
