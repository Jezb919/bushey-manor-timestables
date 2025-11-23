export default function Home() {
  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {/* Heading */}
        <h1 style={titleStyle}>Times Tables Arena</h1>
        <p style={subtitleStyle}>Choose your mode</p>

        {/* Buttons */}
        <div style={{ marginTop: "2rem" }}>
          <a href="/student" style={buttonPrimary}>
            Student
          </a>

          <a href="/teacher" style={buttonSecondary}>
            Teacher
          </a>
        </div>
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
  textAlign: "center",
  color: "white",
  boxShadow: "0 0 30px rgba(0,0,0,0.7)",
};

const titleStyle = {
  fontSize: "2.2rem",
  fontWeight: "bold",
  color: "#facc15",
  textShadow: "0 0 20px rgba(250,204,21,0.6)",
};

const subtitleStyle = {
  fontSize: "1.1rem",
  color: "#ddd",
  marginTop: "10px",
};

const buttonPrimary = {
  display: "inline-block",
  padding: "14px 28px",
  marginRight: "20px",
  background: "#facc15",
  color: "#000",
  fontSize: "1.1rem",
  fontWeight: "bold",
  borderRadius: "999px",
  textDecoration: "none",
  transition: "0.2s",
};

const buttonSecondary = {
  display: "inline-block",
  padding: "14px 28px",
  background: "#555",
  color: "white",
  fontSize: "1.1rem",
  fontWeight: "bold",
  borderRadius: "999px",
  textDecoration: "none",
  transition: "0.2s",
};
