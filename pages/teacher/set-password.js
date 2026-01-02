import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function TeacherSetPassword() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [status, setStatus] = useState({ type: "idle", msg: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (router.isReady && !token) {
      setStatus({ type: "error", msg: "Missing token. Ask admin to send a new setup link." });
    }
  }, [router.isReady, token]);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus({ type: "idle", msg: "" });

    if (!token) {
      setStatus({ type: "error", msg: "Missing token. Ask admin to send a new setup link." });
      return;
    }
    if (!pw1 || pw1.length < 6) {
      setStatus({ type: "error", msg: "Password must be at least 6 characters." });
      return;
    }
    if (pw1 !== pw2) {
      setStatus({ type: "error", msg: "Passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/teacher/set_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw1 }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j.ok) {
        setStatus({
          type: "error",
          msg: j?.error || `Failed to set password (${r.status})`,
        });
        setSaving(false);
        return;
      }

      setStatus({ type: "success", msg: "Password set! You can now log in." });
      setSaving(false);

      // Send them to login after a moment
      setTimeout(() => {
        router.push("/teacher/login");
      }, 700);
    } catch (err) {
      setSaving(false);
      setStatus({ type: "error", msg: "Network error. Please try again." });
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 56, marginBottom: 10 }}>Set your password</h1>
      <p style={{ fontSize: 18, lineHeight: 1.5, marginTop: 0 }}>
        Use this page to create your teacher password. If the link expired, ask your admin to send a new one.
      </p>

      {status.type === "error" && (
        <div style={{ background: "#ffe5e5", border: "1px solid #ffb3b3", padding: 14, borderRadius: 10, margin: "16px 0" }}>
          {status.msg}
        </div>
      )}
      {status.type === "success" && (
        <div style={{ background: "#e8fff0", border: "1px solid #9be5b1", padding: 14, borderRadius: 10, margin: "16px 0" }}>
          {status.msg}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>New password</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ccc", fontSize: 18 }}
            placeholder="At least 6 characters"
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Confirm password</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "1px solid #ccc", fontSize: 18 }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 22px",
            borderRadius: 12,
            border: "1px solid #bbb",
            background: saving ? "#f2f2f2" : "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {saving ? "Saving..." : "Set password"}
        </button>

        <div style={{ marginTop: 18 }}>
          <a href="/teacher/login">Go to teacher login</a>
        </div>
      </form>
    </div>
  );
}
