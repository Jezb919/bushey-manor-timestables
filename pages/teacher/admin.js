// pages/teacher/admin.js
export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/teacher/admin/teachers",
      permanent: false,
    },
  };
}

export default function AdminRedirect() {
  return null;
}
