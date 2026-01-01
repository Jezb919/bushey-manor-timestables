// pages/teacher/login.js
import { useState } from "react";
import { useRouter } from "next/router";

export default function TeacherLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const r = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data.ok) {
        setMsg(data?.error || `Login failed (${r.status})`);
        setLoading(false);
        return;
      }

      // success
      router.push("/teacher");
    } catch (err) {
      setMsg("Login failed (network error)");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>Teacher Login</h1>
      <p style={{ marginTop: 0, marginBottom: 18 }}>
        Enter your <b>email</b> and <b>password</b>.
      </p>

      {msg && (
        <div
          style={{
            background: "#ffe5e5",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 10 }}>
          <input
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 16,
            }}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <input
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 16,
            }}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            border: "none",
            background: "#0b1220",
            color: "white",
            fontSize: 18,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        <a href="/" style={{ color: "#4b3fbf" }}>
          ← Back
        </a>
      </div>
    </div>
  );
}
