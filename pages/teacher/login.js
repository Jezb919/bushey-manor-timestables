// pages/teacher/login.js
import { useEffect, useState } from "react";

export default function TeacherLogin() {
  const [email, setEmail] = useState("admin@busheymanor.local");
  const [password, setPassword] = useState("admin123");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, go to /teacher
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((j) => {
        if (j?.loggedIn) window.location.href = "/teacher";
      })
      .catch(() => {});
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data?.error || "Login failed");
        setLoading(false);
        return;
      }

      window.location.href = "/teacher";
    } catch (err) {
      setStatus(String(err?.message || err));
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headRow}>
          <div style={logo}>BM</div>
          <div>
            <div style={kicker}>Teacher / Admin</div>
            <div style={title}>Dashboard Login</div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
          <label style={label}>Email</label>
          <input
            style={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />

          <div style={{ height: 12 }} />

          <label style={label}>Password</label>
          <input
            style={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />

          <button style={button(loading)} disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {status && <div style={errorBox}>{status}</div>}
        </form>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <a href="/" style={{ color: "#6B7280", textDecoration: "underline", fontSize: 13 }}>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#F7F7FB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const cardStyle = {
  background: "white",
  borderRadius: 18,
  padding: "1.8rem 2rem",
  width: "100%",
  maxWidth: 460,
  border: "1px solid #E5E7EB",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
};

const headRow = { display: "flex", alignItems: "center", gap: 12 };

const logo = {
  width: 54,
  height: 54,
  borderRadius: 999,
  background: "#FACC15",
  display: "grid",
  placeItems: "center",
  fontWeight: 1000,
};

const kicker = {
  fontSize: 12,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#6B7280",
  fontWeight: 900,
};

const title = { fontSize: 22, fontWeight: 1000, color: "#111827" };

const label = { display: "block", fontSize: 13, fontWeight: 900, color: "#374151", marginBottom: 6 };

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #D1D5DB",
  fontSize: 15,
  outline: "none",
};

const button = (loading) => ({
  marginTop: 14,
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "none",
  cursor: loading ? "default" : "pointer",
  fontWeight: 1000,
  background: loading ? "#9CA3AF" : "linear-gradient(135deg,#2563EB,#60A5FA)",
  color: "white",
});

const errorBox = {
  marginTop: 12,
  padding: 10,
  borderRadius: 12,
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  color: "#991B1B",
  fontWeight: 800,
};
