export async function getServerSideProps(context) {
  const cookies = context.req.cookies || {};
  const raw = cookies.bmtt_teacher;

  // Not logged in -> go to login
  if (!raw) {
    return {
      redirect: { destination: "/teacher/login", permanent: false },
    };
  }

  // Logged in -> go to dashboard
  return {
    redirect: { destination: "/teacher/dashboard", permanent: false },
  };
}

export default function TeacherIndex() {
  return null;
}
