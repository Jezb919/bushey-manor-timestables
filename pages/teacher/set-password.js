import { useEffect, useState } from "react";

export default function SetPasswordPage() {
  const [token, setToken] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!token) {
      setErr("Missing token. Please use the link from the email.");
      return;
    }
    if (!p1 || p1.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (p1 !== p2) {
      setErr("Passwords do not match.");
      return;
    }

    const r = await fetch("/api/teacher/set_password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: p1 }),
    });

    const j = await r.json();
    if (!j.ok) {
      setErr(j.error || "Failed");
      return;
    }

    setMsg("Password set ✅ You can now log in.");
    setTimeout(() => {
      window.location.href = "/teacher/login";
    }, 1200);
  }

  return (
    <div style={{ padding: 30, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36, fontWeight: 900 }}>Set your password</h1>
      <p style={{ opacity: 0.75 }}>
        Use this page to create your teacher password. If the link expired, ask your admin to send a new one.
      </p>

      {err && <div style={{ color: "#b91c1c", fontWeight: 900, marginTop: 10 }}>{err}</div>}
      {msg && <div style={{ color: "#166534", fontWeight: 900, marginTop: 10 }}>{msg}</div>}

      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <label style={lab}>New password</label>
        <input
          type="password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          style={inp}
        />

        <label style={lab}>Confirm password</label>
        <input
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          style={inp}
        />

        <button style={btn} type="submit">Set password</button>
      </form>
    </div>
  );
}

const lab = { display: "block", marginTop: 12, fontWeight: 800 };
const inp = { width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", marginTop: 6 };
const btn = { marginTop: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "#fff", fontWeight: 900, cursor: "pointer" };
