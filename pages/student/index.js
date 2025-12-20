import { useState } from "react";

const SETTINGS_KEY = "bmtt_teacher_settings_v2";

function safeReadTeacherSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);

    const questionCount = Number(s.questionCount);
    const secondsPerQuestion = Number(s.secondsPerQuestion);
    const tablesIncluded = Array.isArray(s.tablesIncluded) ? s.tablesIncluded : null;

    const qc =
      Number.isFinite(questionCount) ? Math.max(10, Math.min(60, questionCount)) : null;

    const sec =
      Number.isFinite(secondsPerQuestion) ? Math.max(3, Math.min(6, secondsPerQuestion)) : null;

    const tables =
      tablesIncluded && tablesIncluded.length
        ? tablesIncluded
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19)
        : null;

    return { qc, sec, tables };
  } catch {
    return null;
  }
}

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const encodedName = encodeURIComponent(name.trim());
    const encodedClass = encodeURIComponent(className.trim());

    // ✅ Read teacher settings (saved in this browser) and pass them into the test URL
    const s = safeReadTeacherSettings();

    const qs = new URLSearchParams();
    qs.set("name", encodedName);
    qs.set("class", encodedClass);

    if (s?.qc) qs.set("qc", String(s.qc));
    if (s?.sec) qs.set("sec", String(s.sec));
    if (s?.tables?.length) qs.set("tables", s.tables.join(","));

    // ✅ Go straight to the real test file
    window.location.href = `/student/tests/mixed?${qs.toString()}`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(3,7,18,0.95)",
          borderRadius: "22px",
          padding: "2rem 2.5rem",
          maxWidth: "520px",
          width: "100%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
          border: "1px solid rgba(148,163,184,0.35)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "white",
              border: "3px solid #facc15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>
              BM
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#e5e7eb",
              }}
            >
              Student Login
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#facc15" }}>
              Times Tables Test
            </div>
          </div>
        </div>

        <p style={{ color: "#d1d5db", fontSize: "0.95rem" }}>
          Please enter your <strong>name</strong> and <strong>class</strong>.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem", color: "#e5e7eb" }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "1rem",
                borderRadius: "999px",
                border: "1px solid #4b5563",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.9rem", color: "#e5e7eb" }}>
              Class (e.g. M4, B4, M6)
            </label>
            <input
              type="text"
              value={className}
              required
              onChange={(e) => setClassName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: "1rem",
                borderRadius: "999px",
                border: "1px solid #4b5563",
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
              color: "white",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Start Test
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/" style={{ fontSize: "0.85rem", color: "#9ca3af", textDecoration: "underline" }}>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
