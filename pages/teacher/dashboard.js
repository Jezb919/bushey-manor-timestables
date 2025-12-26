import Link from "next/link";

export async function getServerSideProps(context) {
  const raw = context.req.cookies?.bmtt_teacher;

  if (!raw) {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }

  try {
    const session = JSON.parse(raw);
    return { props: { session } };
  } catch {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }
}

export default function TeacherDashboard({ session }) {
  const role = session?.role || "teacher";

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  return (
    <div style={{ padding: 30 }}>
      <h1 style={{ fontSize: 40, fontWeight: 900 }}>Teacher Dashboard</h1>

      <p style={{ opacity: 0.75 }}>
        Logged in as <b>{session?.email || "unknown"}</b> ({role})
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/teacher/class-overview">Class overview</Link>
        <span>•</span>
        <Link href="/teacher/admin/attainment-individual">Individual graphs</Link>
        <span>•</span>
        <Link href="/teacher/admin/attainment-class">Class graphs</Link>

        {role === "admin" && (
          <>
            <span>•</span>
            <Link href="/teacher/admin">Admin area</Link>
            <span>•</span>
            <Link href="/teacher/admin/teachers">Manage teachers</Link>
            <span>•</span>
            <Link href="/teacher/admin/pupils">Manage pupils</Link>
          </>
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <button
          onClick={logout}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
