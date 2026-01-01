export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/teacher",
      permanent: false,
    },
  };
}

export default function DashboardRedirect() {
  return null;
}
