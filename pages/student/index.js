export default function Home() {
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
          padding: "2.25rem 2.75rem",
          maxWidth: "720px",
          width: "100%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
          border: "1px solid rgba(148,163,184,0.35)",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "white",
                border: "3px solid #facc15",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {/* You can upload /public/bushey-logo.png later */}
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1.3rem",
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
                Bushey Manor Junior School
              </div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "#facc15",
                }}
              >
                Times Tables Arena
              </div>
            </div>
          </div>
        </div>

        {/* Intro text */}
        <div style={{ marginTop: "1.75rem" }}>
          <h1
            style={{
              fontSize: "1.8rem",
              marginBottom: "0.4rem",
              color: "#f9fafb",
            }}
          >
            Welcome!
          </h1>
          <p style={{ color: "#d1d5db", fontSize: "0.98rem" }}>
            Choose whether you are a{" "}
            <strong>Student</strong> ready to take a times tables test or a{" "}
            <strong>Teacher</strong> managing tests and results.
          </p>
        </div>

        {/* Buttons */}
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <a
            href="/student"
            style={{
              flex: "1 1 180px",
              padding: "1rem 1.2rem",
              borderRadius: "999px",
              textAlign: "center",
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "0.95rem",
              background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
              color: "#f9fafb",
              boxShadow: "0 10px 25px rgba(59,130,246,0.45)",
            }}
          >
            Student
          </a>

          <a
            href="/teacher"
            style={{
              flex: "1 1 180px",
              padding: "1rem 1.2rem",
              borderRadius: "999px",
              textAlign: "center",
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "0.95rem",
              background: "linear-gradient(135deg,#6b7280,#9ca3af)",
              color: "#f9fafb",
              boxShadow: "0 10px 25px rgba(15,23,42,0.6)",
            }}
          >
            Teacher
          </a>
        </div>
      </div>
    </div>
  );
}
