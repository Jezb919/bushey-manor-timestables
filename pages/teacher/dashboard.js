// pages/teacher/dashboard.js
import { useEffect, useState } from "react";

export default function TeacherDashboard() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setErr("");
        const res = await fetch("/api/teacher/whoami?debug=1", {
          credentials: "include",
        });

        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setMe(null);
          setErr(data?.error || "Not logged in.");
          return;
        }

        // Normalise fields across versions
        const role = data.parsedRole || data.role || data.me?.role || "teacher";
        const email =
          data.email ||
          data.parsedEmail ||
          data.me?.email ||
          (data.parsedKeys?.includes("email") ? undefined : undefined);

        setMe({
          role,
          email: email || (role === "admin" ? "admin" : "teacher"),
          raw: data,
        });
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || "Failed to load session.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = me?.role === "admin";
  const title = isAdmin ? "Admin Dashboard" : "Teacher Dashboard";

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 56, margin: "0 0 10px 0" }}>{title}</h1>

      <div style={{ marginBottom: 18 }}>
        {me ? (
          <div style={{ fontSize: 18 }}>
            Logged in as <b>{me.email}</b> ({me.role})
          </div>
        ) : (
          <div style={{ fontSize: 18 }}>
            Logged in as <b>unknown</b>
          </div>
        )}
      </div>

      {err ? (
        <div
          style={{
            background: "#ffecec",
            border: "1px solid #f5b5b5",
            padding: "12px 14px",
            borderRadius: 10,
            marginBottom: 18,
            color: "#7a1f1f",
          }}
        >
          {err}
        </div>
      ) : null}

      <nav style={{ fontSize: 18, marginBottom: 18 }}>
        <a href="/teacher/class-overview">Class overview</a> {" \u00B7 "}
        <a href="/teacher/attainment-overview">Individual graphs</a> {" \u00B7 "}
        <a href="/teacher/class-graphs">Class graphs</a>

        {/* Admin-only links */}
        {isAdmin ? (
          <>
            {" \u00B7 "}
            <a href="/teacher/admin/teachers">Manage teachers</a> {" \u00B7 "}
            <a href="/teacher/admin/pupils">Manage pupils</a>
          </>
        ) : null}
      </nav>

      <div style={{ marginTop: 18 }}>
        <a
          href="/teacher/logout"
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            textDecoration: "none",
            fontSize: 18,
          }}
        >
          Log out
        </a>
      </div>
    </div>
  );
}
