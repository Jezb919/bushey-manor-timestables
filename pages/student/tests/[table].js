  boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
  border: "1px solid rgba(148,163,184,0.3)",
};

const questionStyle = {
  fontSize: "3.5rem",
  fontWeight: 800,
  color: "#f9fafb",
  textShadow: "0 0 20px rgba(0,0,0,0.7)",
};

const inputStyle = {
  marginTop: "0.75rem",
  padding: "14px",
  fontSize: "1.75rem",
  width: "170px",
  textAlign: "center",
  borderRadius: "999px",
  border: "2px solid #facc15",
  backgroundColor: "#020617",
  color: "white",
  outline: "none",
};

const buttonStyle = (waiting) => ({
  padding: "12px 28px",
  fontSize: "1.1rem",
  fontWeight: 700,
  borderRadius: "999px",
  background: waiting
    ? "#4b5563"
    : "linear-gradient(135deg,#f59e0b,#facc15)",
  color: waiting ? "#e5e7eb" : "#111827",
  cursor: waiting ? "default" : "pointer",
});

/* ---------- Header Component ---------- */

function Header({ question, total, progress }) {
  return (
    <div>
      {/* Top Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
            }}
          >
            <img
              src="/bushey-logo.png"
              alt="Bushey Manor"
              style={{ width: "100%", height: "100%", borderRadius: "50%" }}
            />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#e5e7eb" }}>
              Bushey Manor
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#facc15",
              }}
            >
              Times Tables Arena
            </div>
          </div>
        </div>

        {question && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
              Question
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {typeof progress === "number" && (
        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "#0f172a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background:
                "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      )}
    </div>
  );
}
