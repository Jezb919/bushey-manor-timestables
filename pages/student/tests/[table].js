import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function TestPage() {
  const router = useRouter();
  const { table } = router.query;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false); // during 2 second gap

  // 25 questions
  const questions = Array.from({ length: 25 }).map(() => {
    const num = Math.floor(Math.random() * 12) + 1;
    return {
      a: num,
      b: table,
      correct: num * table,
    };
  });

  const current = questions[questionIndex];

  // ⏳ 6-second countdown before test starts
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowQuestion(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  // Handle pressing ENTER
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !waiting) {
      submitAnswer();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const submitAnswer = () => {
    if (waiting) return;

    if (parseInt(answer) === current.correct) {
      setScore(score + 1);
    }

    setAnswer("");
    setWaiting(true);

    // ⏸ 2-second gap before next question
    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setQuestionIndex(questionIndex + 1);
      } else {
        router.push(
          `/student/tests/result?score=${score + 1}&total=${questions.length}`
        );
      }
    }, 2000);
  };

  if (!table) return <p>Loading...</p>;

  if (!showQuestion) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Arial" }}>
        <h1>{table} Times Table Test</h1>
        <h2>Get Ready…</h2>
        <p>The test will begin in 6 seconds.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>{table} Times Table Test</h1>

      <h2>
        Question {questionIndex + 1}: {current.a} × {current.b} = ?
      </h2>

      <input
        value={answer}
        disabled={waiting}
        onChange={(e) => setAnswer(e.target.value)}
        style={{ padding: "10px", fontSize: "20px", width: "120px" }}
        autoFocus
      />

      <div>
        <button
          onClick={submitAnswer}
          disabled={waiting}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            fontSize: "18px",
            background: waiting ? "grey" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "5px",
          }}
        >
          Submit
        </button>
      </div>

      {waiting && <p style={{ marginTop: "10px" }}>Next question coming…</p>}
    </div>
  );
}
