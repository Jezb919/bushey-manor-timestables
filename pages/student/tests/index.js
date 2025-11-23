export default function TestsPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Maths Test</h1>
      <p>This test includes mixed times tables.</p>

      <a
        href="/student/tests/start"
        style={{
          display: "inline-block",
          padding: "15px 25px",
          background: "#0070f3",
          color: "white",
          borderRadius: "5px",
          textDecoration: "none",
          fontSize: "20px",
          marginTop: "20px",
        }}
      >
        Start Test
      </a>
    </div>
  );
}
