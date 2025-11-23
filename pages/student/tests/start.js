import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

export default function MixedTest() {
  const router = useRouter();

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // Input focus handling
  const inputRef = useRef(null);

  // Tables allowed – later this will come from teacher settings
  const allowedTables = [1,2,3,4,5,6,7,8,9,10,11,12];

  // Generate 25 mixed questions
  useEffect(() => {
    const generated = Array.from({ length: 25 }).map(() => {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = allowedTables[Math.floor(Math.random() * allowedTables.length)];
      return {
        a,
        b,
        correct: a * b,
      };
    });

    setQuestions(generated);
  }, []);

  const current = questions[questionIndex];

  // 6-second countdown
  useEffect(() => {
    const timer = setTimeout(() => setShowQuestion(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Press Enter to submit
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !waiting) {
      submitAnswer();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Automatically focus input whenever question changes
  useEffect(() => {
    if (!waiting && inputRef.current) {
      inputRef.current.focus();
    }
  }, [questionIndex, waiting]);

  const submitAnswer = () => {
    if (waiting) return;

    if (parseInt(answer) === current.correct) {
      setScore(score + 1);
    }

    setAnswer("");
    setWaiting(true);

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

  if (!questions.length)
    return <p style={{ padding: "2rem" }}>Loading questions…</p>;

  if (!showQuestion) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Arial" }}>
        <h1>Mixed Times Test</h1>
        <h2>Get Ready…</h2>
        <p>The test will begin in 6 seconds.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Mixed Times Test</h1>

      <h2>
        Question {questionIndex + 1}: {current.a} × {current.b} = ?
      </h2>

      <input
        ref={inputRef}
        value={answer}
        disabled={waiting}
        onChange={(e) => setAnswer(e.target.value)}
        style={{ padding: "10px", fontSize: "20px", width: "120px" }}
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
