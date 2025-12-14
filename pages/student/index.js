import { useMemo, useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  // Allowed classes exactly as you requested
  const allowedClasses = useMemo(
    () => ["M3", "B3", "M4", "B4", "M5", "B5", "M6", "B6"],
    []
  );

  const normaliseName = (v) => String(v || "").trim();
  const normaliseClass = (v) =>
    String(v || "").toUpperCase().replace(/\s+/g, "").trim();

  const classValue = normaliseClass(className);

  const classIsValid = allowedClasses.includes(classValue);
  const nameIsValid = normaliseName(name).length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalName = normaliseName(name);
    const finalClass = normaliseClass(className);

    if (!finalName) return;
    if (!allowedClasses.includes(finalClass)) return;

    window.location.href = `/student/tests?name=${encodeURIComponent(
      finalName
    )}&class=${encodeURIComponent(finalClass)}`;
  };

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerRow}>
          <div style={badgeStyle}>BM</div>

          <div>
            <div style={smallCaps}>Student Login</div>
            <div style={titleStyle}>Times Tables Test</div>
          </div>
        </div>

        <p style={{ color: "#d1d5db", fontSize: "0.95rem" }}>
          Please enter your <strong>name</strong> and select your{" "}
          <strong>class</strong>.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
          {/* Name */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Sam"
            />
          </div>

          {/* Class dropdown */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Class</label>

            <select
              value={classValue}
              required
              onChange={(e) => setClassName(e.target.value)}
              style={selectStyle}
            >
              <option value="" disabled>
                Select your class…
              </option>
              {allowedClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              <span style={{ color: "#9ca3af" }}>Allowed:</span>{" "}
              <span style={{ color: "#e5e7eb" }}>
                {allowedClasses.join(", ")}
              </span>
            </div>

            {/* If user typed something weird (only possible if you switch back to input) */}
            {!classIsValid && classValue !== "" && (
              <div style={{ marginTop: "0.5rem", color: "#fca5a5", fontSize: "0.9rem" }}>
                Please select a valid class (e.g. M4, B4).
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!nameIsValid || !classIsValid}
            style={buttonStyle(!nameIsValid || !classIsValid)}
          >
            Start Test
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/" style={backLinkStyle}>
            Back to Home
          </a>
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
  maxWidth: "520px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
  marginBottom: "1.25rem",
};

const badgeStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "white",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "1.1rem",
  color: "#0f172a",
};

const smallCaps = {
  fontSize: "0.75rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const titleStyle = {
  fontSize: "1.3rem",
  fontWeight: 900,
  color: "#facc15",
};

const labelStyle = {
  display: "block",
  marginBottom: "0.35rem",
  fontSize: "0.9rem",
  color: "#e5e7eb",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "1rem",
  borderRadius: "999px",
  border: "1px solid #4b5563",
  outline: "none",
};

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "1rem",
  borderRadius: "999px",
  border: "1px solid #4b5563",
  outline: "none",
  background: "white",
  color: "#111827",
};

const buttonStyle = (disabled) => ({
  width: "100%",
  padding: "12px",
  borderRadius: "999px",
  border: "none",
  background: disabled
    ? "#4b5563"
    : "linear-gradient(135deg,#3b82f6,#60a5fa)",
  color: "white",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "0.95rem",
});

const backLinkStyle = {
  fontSize: "0.85rem",
  color: "#9ca3af",
  textDecoration: "underline",
};
