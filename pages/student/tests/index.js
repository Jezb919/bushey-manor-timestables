import { useRouter } from "next/router";

export default function TestStart() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const safeName = typeof name === "string" ? name.trim() : "";
  const safeClass = typeof className === "string" ? className.trim() : "";

  const goToTest = () => {
    // Send them to the REAL test page
    router.push(
      `/student/tests/mixed?name=${encodeURIComponent(safeName)}&class=${encodeURIComponent(
        safeClass
      )}`
    );
  };

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "2.2rem" }}>Maths Test</h1>

          <p style={{ color: "#d1d5db", marginTop: "0.75rem" }}>
            This test includes <strong>mixed times tables</strong>.
          </p>

          {/* If they arrived without name/class, send them back */}
          {(!safeName || !safeClass) && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ color: "#fca5a5", marginBottom: "0.75rem" }}>
                Name and class missing — please go back and enter them.
              </p>
              <a href="/student" style={linkStyle}>
                Go to Student Login
              </a>
            </div>
          )}

          <div style={{ marginTop: "1.75rem" }}>
            <button
              onClick={goToTest}
              disabled={!safeName || !safeClass}
              style={buttonStyle(!safeName || !safeClass)}
            >
              Start Test
            </button>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <a href="/student" style={linkStyle}>
              Back to Student Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const outerStyle = {
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
};

const cardStyle = {
  background: "rgba(3,7,18,0.95)",
  borderRadius: "22px",
  padding: "2rem 2.5rem",
  maxWidth: "680px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const buttonStyle = (disabled) => ({
  padding: "14px 28px",
  fontSize: "1.05rem",
  fontWeight: 800,
  borderRadius: "999px",
  border: "none",
  width: "240px",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled
    ? "#4b5563"
    : "linear-gradient(135deg,#f59e0b,#facc15)",
  color: disabled ? "#e5e7eb" : "#111827",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
});

const linkStyle = {
  fontSize: "0.9rem",
  color: "#9ca3af",
  textDecoration: "underline",
};

function Header() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.8rem",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "white",
          border: "3px solid #facc15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        BM
      </div>

      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#e5e7eb",
          }}
        >
          Bushey Manor
        </div>
        <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#facc15" }}>
          Times Tables Arena
        </div>
      </div>
    </div>
  );
}
