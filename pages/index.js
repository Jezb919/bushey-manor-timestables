export default function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Bushey Manor Times Tables App</h1>
      <p>Select an option:</p>

      <div style={{ marginTop: "2rem" }}>
        <a
          href="/student"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            marginRight: "20px",
            background: "#0070f3",
            color: "white",
            borderRadius: "5px",
            textDecoration: "none",
            fontSize: "18px",
          }}
        >
          Student
        </a>

        <a
          href="/teacher"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            background: "#555",
            color: "white",
            borderRadius: "5px",
            textDecoration: "none",
            fontSize: "18px",
          }}
        >
          Teacher
        </a>
      </div>
    </div>
  );
}

