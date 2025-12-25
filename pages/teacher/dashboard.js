import Link from "next/link";

export async function getServerSideProps(context) {
  const raw = context.req.cookies?.bmtt_teacher;

  if (!raw) {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }

  let session = null;
  try {
    session = JSON.parse(raw);
  } catch {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }

  return { props: { session } };
}

export default function TeacherDashboard({ session }) {
  const role = session?.role || "teacher";

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 34, fontWeight: 900 }}>Teacher Dashboard</h1>
      <p style={{ opacity: 0.7 }}>
        Logged in as <b>{session?.email || "unknown"}</b> ({role})
      </p>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
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

      <div style={{ marginTop: 24 }}>
        <a href="/api/teacher/logout" style={{ fontWeight: 800 }}>
          Log out
        </a>
      </div>
    </div>
  );
}
