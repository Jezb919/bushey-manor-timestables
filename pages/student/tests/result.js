import { useRouter } from "next/router";

export default function ResultPage() {
  const router = useRouter();
  const { score, total } = router.query;

  if (!score || !total) {
    return <p>Loading...</p>;
  }

  const percentage = Math.round((score / total) * 100);

  let message = "Great job!";
  if (percentage < 40) message = "Keep practising!";
  else if (percentage < 70) message = "Good effort!";
  else if (percentage < 90) message = "Well done!";
  else message = "Excellent!";

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Test Finished!</h1>

      <h2>
        You scored {score} out of {total} ({percentage}%)
      </h2>

      <h3>{message}</h3>

      <div style={{ marginTop: "2rem" }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "10px 20px",
            marginRight: "20px",
            background: "#0070f3",
            color: "white",
            borderRadius: "5px",
            border: "none",
            fontSize: "16px",
          }}
        >
          Try Again
        </button>

        <a
          href="/student/tests"
          style={{
            padding: "10px 20px",
            marginRight: "20px",
            background: "#555",
            color: "white",
            borderRadius: "5px",
            textDecoration: "none",
            fontSize: "16px",
          }}
        >
          Choose Another Test
        </a>

        <a
          href="/"
          style={{
            padding: "10px 20px",
            background: "#333",
            color: "white",
            borderRadius: "5px",
            textDecoration: "none",
            fontSize: "16px",
          }}
        >
          Home
        </a>
      </div>
    </div>
  );
}
