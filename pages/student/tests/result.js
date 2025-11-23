import { useRouter } from "next/router";

export default function ResultPage() {
  const router = useRouter();
  const { score, total } = router.query;

  if (!score || !total) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <p style={{ color: "white", textAlign: "center" }}>Loading…</p>
        </div>
      </div>
    );
  }

  const s = parseInt(score);
  const t = parseInt(total);
  const percentage = Math.round((s / t) * 100);

  let message = "Great job!";
  if (percentage < 40) message = "Keep practising!";
  else if (percentage < 70) message = "Good effort!";
  else if (percentage < 90) message = "Well done!";
  else message = "Excellent!";

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header title="Test Complete" />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <div
            style={{
              fontSize: "4rem",
              fontWeight: 800,
              color: "#facc15",
              textShadow: "0 0 25px rgba(250,204,21,0.5)",
            }}
          >
            {percentage}%
          </div>

          <p
            style={{
              color: "#e5e7eb",
              fontSize: "1.25rem",
              marginTop: "0.5rem",
            }}
          >
            You scored{" "}
            <strong style={{ color: "#facc15" }}>
              {s} / {t}
            </strong>
          </p>

          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "1.1rem",
              color: "#9ca3af",
            }}
          >
            {message}
          </p>

          {/* Progress bar */}
          <div style={{ marginTop: "1.5rem" }}>
            <div
              style={{
                height: "12px",
                borderRadius: "999px",
                background: "#020617",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${percentage}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
                  transition: "width 0.3s ease-out",
                }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div
            style={{
              marginTop: "2.5rem",
              display: "flex",
              justifyContent: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => router.back()}
              style={buttonPrimary}
            >
              Try Again
            </button>

            <a href="/student/tests" style={buttonSecondary}>
              Choose Another Test
            </a>

            <a href="/" style={buttonDark}>
              Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Header with branding ---------- */

function Header({ title }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* Logo circle */}
      <div
        style={{
          width: "72px",
          height: "72px",
          margin: "0 auto",
          borderRadius: "999px",
          background: "#f9fafb",
          border: "3px solid #facc15",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src="/bushey-logo.png"
          alt="Bushey Manor"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <h1
        style={{
          marginTop: "0.75rem",
          color: "#facc15",
          fontSize: "1.8rem",
          letterSpacing: "0.05em",
          fontWeight: 800,
        }}
      >
        {title}
      </h1>
    </div>
  );
}

/* ---------- Shared styles ---------- */

const outerStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  background: "rgba(3,7,18,0.95)",
  borderRadius: "20px",
  padding: "2rem 2.5rem",
  maxWidth: "650px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
  border: "1px solid rgba(148,163,184,0.3)",
  color: "white",
};

const buttonPrimary = {
  padding: "12px 26px",
  borderRadius: "999px",
  background: "linear-gradient(135deg,#f59e0b,#facc15)",
  color: "#111827",
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  fontSize: "0.95rem",
  boxShadow: "0 0 18px rgba(250,204,21,0.4)",
};

const buttonSecondary = {
  padding: "12px 26px",
  borderRadius: "999px",
  background: "#334155",
  color: "white",
  fontWeight: 700,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontSize: "0.95rem",
};

const buttonDark = {
  padding: "12px 26px",
  borderRadius: "999px",
  background: "#111827",
  color: "#facc15",
  fontWeight: 700,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontSize: "0.95rem",
};
