// pages/student/login.js
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

export default function StudentLoginPage() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault(); // IMPORTANT: stops browser doing GET
    setMsg("");
    setBusy(true);

    try {
      const resp = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // IMPORTANT: so cookie is saved
        body: JSON.stringify({
          username: username.trim(),
          pin: pin.trim(),
        }),
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {
        // ignore JSON parse error
      }

      if (!resp.ok || !data?.ok) {
        const errText =
          data?.error || `Login failed (${resp.status})`;
        setMsg(errText);
        setBusy(false);
        return;
      }

      // Success -> go to student tests home
      window.location.href = "/student/tests";
    } catch (err) {
      setMsg("Login failed (network error)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Student Login</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#f6f7fb",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            background: "white",
            borderRadius: 18,
            padding: 28,
            boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ fontSize: 56, margin: 0 }}>Student Login</h1>
          <p style={{ marginTop: 8, fontSize: 18, color: "#333" }}>
            Enter your <b>username</b> and PIN.
          </p>

          {msg ? (
            <div
              style={{
                marginTop: 16,
                background: "#fde7e7",
                border: "1px solid #f4bcbc",
                color: "#7a1b1b",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 18,
              }}
            >
              {msg}
            </div>
          ) : null}

          <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              style={inputStyle}
              disabled={busy}
            />

            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN (4 digits)"
              inputMode="numeric"
              autoComplete="current-password"
              style={inputStyle}
              disabled={busy}
            />

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 12,
                width: "100%",
                borderRadius: 14,
                padding: "16px 18px",
                fontSize: 18,
                border: "none",
                cursor: busy ? "not-allowed" : "pointer",
                background: "#0b1220",
                color: "white",
              }}
            >
              {busy ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: "#334" }}>
              ← Back
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: 14,
  padding: "16px 18px",
  fontSize: 18,
  border: "1px solid #d7dbe5",
  outline: "none",
  marginTop: 12,
};
