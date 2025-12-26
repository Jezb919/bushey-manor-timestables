import { useEffect } from "react";

export default function TeacherLogoutPage() {
  useEffect(() => {
    (async () => {
      await fetch("/api/teacher/logout", { method: "POST" });
      window.location.href = "/teacher/login";
    })();
  }, []);

  return <div style={{ padding: 30 }}>Logging you out…</div>;
}
