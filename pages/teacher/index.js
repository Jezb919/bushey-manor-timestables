import Link from "next/link";
import { useEffect, useState } from "react";

export default function TeacherHome() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Try to load who is logged in
        // (your project has used /api/teacher/me in places; if not present, it will just fall back)
        let r = await fetch("/api/teacher/me");
        if (!r.ok) r = await fetch("/api/teacher/session");
        const j = await r.json();

        if (!cancelled) {
          setMe(j?.teacher || j?.session || j || null);
        }
      } catch (e) {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const role =
    me?.role || me?.teacher?.role || me?.session?.role || (me?.signedIn ? "teacher" : null);
  const email = me?.email || me?.teacher?.email || me?.session?.email || "unknown";
  const displayRole = role || "unknown";

  const isAdmin = displayRole === "admin";

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 56, margin: 0 }}>{isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}</h1>

      <p style={{ marginTop: 12, fontSize: 18 }}>
        {loading ? (
          <>Loading session…</>
        ) : (
          <>
            Logged in as <strong>{email}</strong> ({displayRole})
          </>
        )}
      </p>

      <div style={{ marginTop: 18 }}>
        <Link href="/teacher/logout" style={{ display: "inline-block", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 10 }}>
          Log out
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginTop: 28 }}>
        <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 28 }}>Teaching tools</h2>

          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 18, lineHeight: 1.7 }}>
            <li>
              <Link href="/teacher/class-overview">📋 Class overview</Link>
            </li>

            <li>
              {/* This is your “questions + timer” page */}
              <Link href="/teacher/attainment-overview">⚙️ Class settings (questions + timer)</Link>
            </li>

            <li>
              <Link href="/teacher/pupil">📈 Individual graphs</Link>
            </li>

            <li>
              <Link href="/teacher/dashboard">📊 Class graphs</Link>
            </li>
          </ul>
        </section>

        {isAdmin && (
          <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 28 }}>Admin tools</h2>

            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 18, lineHeight: 1.7 }}>
              <li>
                <Link href="/teacher/admin/teachers">🧑‍🏫 Manage teachers</Link>
              </li>
              <li>
                <Link href="/teacher/admin/pupils">🧒 Manage pupils</Link>
              </li>
            </ul>
          </section>
        )}
      </div>

      <div style={{ marginTop: 20, opacity: 0.7, fontSize: 14 }}>
        Tip: If “Back to dashboard” ever takes you to the old dashboard, it’s linking to <code>/teacher/dashboard</code>. We’ll fix that in Step B.
      </div>
    </div>
  );
}
