import { useState } from "react";
import Link from "next/link";

export default function StudentLogin() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const r = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });

      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Invalid login");
        setBusy(false);
        return;
      }

      // Send them to student home (or tests page if you prefer)
      window.location.href = "/student";
    } catch (err) {
      setError("Login failed");
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 30, maxWidth: 760 }}>
      <h1>Pupil login</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. zacjx1"
            style={{ width: "100%", padding: 12, fontSize: 16 }}
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>PIN</label>
          <input
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="4 digits"
            style={{ width: "100%", padding: 12, fontSize: 16 }}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>

        <button
          disabled={busy}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 18,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p style={{ marginTop: 18 }}>
        <Link href="/">Back</Link>
      </p>
    </div>
  );
}
