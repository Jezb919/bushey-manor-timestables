import { useState } from "react";

export default function AdminHeader({ title = "Admin" }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    try {
      setLoggingOut(true);
      await fetch("/api/teacher/logout");
      window.location.href = "/teacher/login";
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div style={wrap}>
      <div>
        <div style={titleStyle}>{title}</div>
        <div style={subStyle}>Admin area</div>
      </div>

      <button onClick={logout} disabled={loggingOut} style={btn(loggingOut)}>
        {loggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}

const wrap = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const titleStyle = { fontSize: 26, fontWeight: 900 };
const subStyle = { opacity: 0.65, marginTop: 2, fontSize: 12 };

const btn = (disabled) => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: disabled ? "rgba(0,0,0,0.06)" : "#fff",
  fontWeight: 900,
  cursor: disabled ? "not-allowed" : "pointer",
});
