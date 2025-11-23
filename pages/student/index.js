import { useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const encodedName = encodeURIComponent(name);
    const encodedClass = encodeURIComponent(className);

    window.location.href = `/student/tests?name=${encodedName}&class=${encodedClass}`;
  };

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Student Login</h1>
        <p style={subtitleStyle}>Enter your name and class to begin</p>

        <form onSubmit={handleSubmit} style={{ marginTop: "2rem" }}>
          {/* Name field */}
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Class field */}
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Class (e.g. 4M)"
              value={className}
              required
              onChange={(e) => setClassName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button type="submit" style={buttonPrimary}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

const outerStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #facc15, #0f172a 50%, #000)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px",
  fontFamily: "Arial",
};

const cardStyle = {
  background: "rgba(0,0,0,0.8)",
  padding: "40px",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "600px",
  color: "white",
  textAlign: "center",
  boxShadow: "0 0 30px rgba(0,0,0,0.7)",
};

const titleStyle = {
  fontSize: "2.1rem",
  fontWeight: "bold",
  color: "#facc15",
  textShadow: "0 0 20px rgba(250,204,21,0.6)",
};

const subtitleStyle = {
  fontSize: "1rem",
  color: "#ddd",
  marginTop: "10px",
};

const inputStyle = {
  padding: "12px",
  width: "250px",
  fontSize: "1.1rem",
  borderRadius: "10px",
  border: "2px solid #facc15",
  outline: "none",
  background: "#111",
  color: "white",
  textAlign: "center",
};

const buttonPrimary = {
  marginTop: "10px",
  padding: "14px 28px",
  background: "#facc15",
  color: "#000",
  fontSize: "1.1rem",
  fontWeight: "bold",
  borderRadius: "999px",
  border: "none",
  cursor: "pointer",
};
