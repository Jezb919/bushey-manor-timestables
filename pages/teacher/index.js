import { useEffect, useState } from "react";
import Link from "next/link";

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
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
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  if (!user) return null;

  return (
    <div style={{ padding: 30 }}>
      <h1>Teacher Dashboard</h1>

      <p>
        Logged in as <b>{user.email}</b> ({user.role})
      </p>

      <nav style={{ marginBottom: 20 }}>
        <Link href="/teacher/attainment-individual">Individual graphs</Link>{" "}
        •{" "}
        <Link href="/teacher/attainment-class">Class graphs</Link>

        {user.role === "admin" && (
          <>
            {" "}
            • <Link href="/teacher/admin">Admin area</Link>
            {" "}
            • <Link href="/teacher/admin/teachers">Manage teachers</Link>
            {" "}
            • <Link href="/teacher/admin/pupils">Manage pupils</Link>
          </>
        )}
      </nav>

      <button onClick={logout}>Log out</button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
