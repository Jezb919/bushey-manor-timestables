import { useState } from "react";
import Link from "next/link";

export default function StudentLogin() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const r = await fetch("/api/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });

      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Invalid login");
        setLoading(false);
        return;
      }

      // go to student start page (or tests page)
      window.location.href = "/student";
    } catch (e2) {
      setError("Login failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 30, maxWidth: 520 }}>
      <h1>Pupil login</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
            placeholder="e.g. zacjx1"
          />
        </label>

        <label>
          PIN
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
            placeholder="4 digits"
          />
        </label>

        <button disabled={loading} style={{ padding: 12, fontSize: 16 }}>
          {loading ? "Logging in..." : "Log in"}
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>

      <p style={{ marginTop: 12 }}>
        <Link href="/">Back</Link>
      </p>
    </div>
  );
}
