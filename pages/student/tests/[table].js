import { useRouter } from "next/router";
import { useState } from "react";

export default function TestPage() {
  const router = useRouter();
  const { table } = router.query; // gets 2, 3, 4 etc.

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  // Generate 10 random questions for this table
 const questions = Array.from({ length: 25 }).map(() => {
    const num = Math.floor(Math.random() * 12) + 1; // 1–12
    return {
      a: num,
      b: table,
      correct: num * table
    };
  });

  const current = questions[questionIndex];

  const submitAnswer = () => {
    if (parseInt(answer) === current.correct) {
      setScore(score + 1);
    }

    setAnswer("");

    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      router.push(`/student/tests/result?score=${score + 1}&total=${questions.length}`);
    }
  };

  if (!table) return <p>Loading...</p>;

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>{table} Times Table Test</h1>

      <h2>
        Question {questionIndex + 1}: {current.a} × {current.b} = ?
      </h2>

      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        style={{ padding: "10px", fontSize: "20px", width: "120px" }}
        autoFocus
      />

      <div>
        <button
          onClick={submitAnswer}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            fontSize: "18px",
            background: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
