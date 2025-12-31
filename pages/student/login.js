import { useState } from "react";

export default function StudentLogin() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setMsg("");
    setLoading(true);

    try {
      const r = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          pin: pin.trim(),
        }),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        setMsg(j?.error || `Login failed (${r.status})`);
        setLoading(false);
        return;
      }

      // Success -> go to test
      // Prefer mixed (your main quiz), fallback to /student/tests
      try {
        const head = await fetch("/student/tests/mixed", { method: "HEAD" });
        window.location.href = head.ok ? "/student/tests/mixed" : "/student/tests";
      } catch {
        window.location.href = "/student/tests";
      }
    } catch (err) {
      setMsg("Login failed (network error)");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 44, marginBottom: 6 }}>Student Login</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Enter your <b>username</b> and <b>PIN</b>.
      </p>

      {msg ? (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          {msg}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username (e.g. sama1)"
          autoComplete="username"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", fontSize: 16 }}
        />

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoComplete="current-password"
          inputMode="numeric"
          style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd", fontSize: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: loading ? "#444" : "#111827",
            color: "white",
            fontSize: 16,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
