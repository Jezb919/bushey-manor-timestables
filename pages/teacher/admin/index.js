import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminHome() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        if (data.user?.role !== "admin") {
          window.location.href = "/teacher";
          return;
        }
        setUser(data.user);
      })
      .catch(() => (window.location.href = "/teacher/login"));
  }, []);

  if (!user) return null;

  return (
    <div style={{ padding: 28, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>Admin Area</h1>
      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Logged in as <b>{user.email}</b> (admin)
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <Link href="/teacher" style={{ textDecoration: "none" }}>
          ← Back to dashboard
        </Link>

        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Management</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <Link href="/teacher/admin/teachers">Manage teachers</Link>
            </li>
            <li>
              <Link href="/teacher/admin/pupils">Manage pupils</Link>
            </li>
          </ul>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Data & Settings</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <Link href="/teacher/class-overview">Class overview (all classes)</Link>
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
      </div>
    </div>
  );
}
