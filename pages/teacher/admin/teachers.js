export async function getServerSideProps(context) {
  const raw = context.req.cookies?.bmtt_teacher;
  if (!raw) return { redirect: { destination: "/teacher/login", permanent: false } };

  try {
    const s = JSON.parse(raw);
    if (s.role !== "admin") {
      return { redirect: { destination: "/teacher/dashboard", permanent: false } };
    }
  } catch {
    return { redirect: { destination: "/teacher/login", permanent: false } };
  }

  return { props: {} };
}
