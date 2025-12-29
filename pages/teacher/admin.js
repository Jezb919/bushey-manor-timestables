export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/teacher/dashboard",
      permanent: false,
    },
  };
}

export default function AdminRedirect() {
  return null;
}
