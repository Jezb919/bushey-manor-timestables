// pages/teacher/login.js
import { useState } from "react";

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Success → go to teacher dashboard
      window.location.href = "/teacher";
    } catch (err) {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <div style={page}>
      <form onSubmit={handleSubmit} style={card}>
        <h1 style={{ marginBottom: "1rem" }}>Teacher Login</h1>

        {error && (
          <div style={{ color: "red", marginBottom: "0.75rem" }}>
            {error}
          </div>
        )}

        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <label>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        <button type="submit" disabled={loading} style={button}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
};

const card = {
  width: "320px",
  padding: "2rem",
  borderRadius: "10px",
  background: "white",
  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const input = {
  padding: "8px",
  fontSize: "1rem",
  marginBottom: "0.75rem",
};

const button = {
  marginTop: "1rem",
  padding: "10px",
  fontSize: "1rem",
  cursor: "pointer",
};
