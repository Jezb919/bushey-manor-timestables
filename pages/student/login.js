// pages/student/login.js
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function StudentLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        setMsg(data?.error ? `Login failed: ${data.error}` : `Login failed (${resp.status})`);
        setLoading(false);
        return;
      }

      // success → go to tests home
      router.push("/student/tests");
    } catch (err) {
      setMsg(`Login failed: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 56, margin: 0 }}>Student Login</h1>
      <p style={{ fontSize: 18, marginTop: 10 }}>
        Enter your <b>username</b> and <b>PIN</b>.
      </p>

      {msg && (
        <div
          style={{
            background: "#fde2e2",
            border: "1px solid #f5b5b5",
            padding: 14,
            borderRadius: 10,
            margin: "18px 0",
            fontSize: 16,
          }}
        >
          {msg}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          style={{
            width: "100%",
            fontSize: 20,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #d0d7de",
            marginBottom: 12,
          }}
        />
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="4-digit PIN"
          inputMode="numeric"
          style={{
            width: "100%",
            fontSize: 20,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #d0d7de",
            marginBottom: 14,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            fontSize: 18,
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background: "#0b1220",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div style={{ marginTop: 18 }}>
        <Link href="/">← Back</Link>
      </div>
    </div>
  );
}
