export default function Home() {
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "Arial" }}>
      <h1>Bushey Manor Times Tables</h1>
      <h2>Select Login</h2>
      <div style={{ marginTop: "40px" }}>
        <a href="/teacher" style={{ display: "inline-block", margin: "20px", padding: "20px 40px", background: "#2D6CDF", color: "white", borderRadius: "8px", textDecoration: "none", fontSize: "20px" }}>Teacher Login</a>
        <a href="/student" style={{ display: "inline-block", margin: "20px", padding: "20px 40px", background: "#4CAF50", color: "white", borderRadius: "8px", textDecoration: "none", fontSize: "20px" }}>Student Login</a>
      </div>
    </div>
  );
}
