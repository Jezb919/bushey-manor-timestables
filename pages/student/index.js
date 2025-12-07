import { useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedClass = className.trim();

    if (!trimmedName || !trimmedClass) {
      alert("Please enter both your name and your class.");
      return;
    }

    // 1. Tell the backend to find/create this student in Supabase
    try {
      const response = await fetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          className: trimmedClass,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error("Student session error:", data);
        alert("There was a problem starting your test. Please tell your teacher.");
        return;
      }
    } catch (err) {
      console.error("Network error calling /api/student/session:", err);
      alert("Could not contact the server. Please check the internet and try again.");
      return;
    }

    // 2. If all good, send them to the test screen with name & class in URL
    const encodedName = encodeURIComponent(trimmedName);
    const encodedClass = encodeURIComponent(trimmedClass);

    window.location.href = `/student/tests?name=${encodedName}&class=${encodedClass}`;
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
            <span
              style={{
                fontWeight: 800,
                fontSize: "1.1rem",
                color: "#0f172a",
              }}
            >
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
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "#facc15",
              }}
            >
              Times Tables Test
            </div>
          </div>
        </div>

        <p style={{ color: "#d1d5db", fontSize: "0.95rem" }}>
          Please enter your <strong>name</strong> and <strong>class</strong> so
          your teacher can see your progress.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.9rem",
                color: "#e5e7eb",
              }}
            >
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
            <label
              style={{
                display: "block",
                marginBottom: "0.35rem",
                fontSize: "0.9rem",
                color: "#e5e7eb",
              }}
            >
              Class (e.g. 3M, 4B)
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
          <a
            href="/"
            style={{
              fontSize: "0.85rem",
              color: "#9ca3af",
              textDecoration: "underline",
            }}
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
