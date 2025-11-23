import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

const TOTAL_QUESTIONS = 25;
const READY_SECONDS = 6;

export default function MixedTablePage() {
  const router = useRouter();

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(6);

  const inputRef = useRef(null);

  const allowedTables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Generate questions once
  useEffect(() => {
    const generated = Array.from({ length: TOTAL_QUESTIONS }).map(() => {
      const a = Math.floor(Math.random() * 12) + 1;
      const b =
        allowedTables[Math.floor(Math.random() * allowedTables.length)];
      return { a, b, correct: a * b };
    });

    setQuestions(generated);
  }, []);

  const current = questions[questionIndex];

  // READY COUNTDOWN (before Q1)
  useEffect(() => {
    if (showQuestion) return;

    if (readySecondsLeft <= 0) {
      setShowQuestion(true);
      return;
    }

    const timer = setTimeout(() => {
      setReadySecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [readySecondsLeft, showQuestion]);

  // STRONG AUTOFOCUS
  const focusInput = () => {
    if (!inputRef.current) return;
    inputRef.current.focus();
    setTimeout(() => inputRef.current && inputRef.current.focus(), 20);
  };

  useEffect(() => {
    if (showQuestion && !waiting) {
      focusInput();
    }
  }, [questionIndex, waiting, showQuestion]);

  // -------------------------------
  // 🔥 **PER-QUESTION TIMER**
  // -------------------------------
  useEffect(() => {
    if (!showQuestion) return;
    if (waiting) return;

    setQuestionSecondsLeft(6);

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [questionIndex, showQuestion, waiting]);

  // ENTER → submit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter" && !waiting && showQuestion) {
        submitAnswer(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showQuestion, waiting]);

  // MAIN SUBMIT
  const submitAnswer = (auto = false) => {
    if (!current || waiting) return;

    const isCorrect = !auto && parseInt(answer) === current.correct;
    const newScore = isCorrect ? score + 1 : score;

    setScore(newScore);
    setAnswer("");
    setWaiting(true);

    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setQuestionIndex((prev) => prev + 1);
      } else {
        router.push(
          `/student/tests/result?score=${newScore}&total=${questions.length}`
        );
      }
    }, 1800);
  };

  // Loading
  if (!questions.length)
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>Loading questions…</div>
      </div>
    );

  // READY SCREEN
  if (!showQuestion) {
    const danger = readySecondsLeft <= 2;

    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <h2
            style={{
              fontSize: "1.2rem",
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#eee",
            }}
          >
            Get Ready…
          </h2>

          <div
            style={{
              fontSize: "5rem",
              fontWeight: "bold",
              color: danger ? "#ff4444" : "#facc15",
              transform: danger ? "scale(1.2)" : "scale(1)",
              transition: "0.2s",
              textShadow: "0 0 20px rgba(250,204,21,0.7)",
              marginTop: "10px",
            }}
          >
            {readySecondsLeft}
          </div>

          <p style={{ color: "#ddd", marginTop: "10px" }}>
            Your test begins in {readySecondsLeft} seconds...
          </p>
        </div>
      </div>
    );
  }

  const progress = (questionIndex + 1) / questions.length;

  // MAIN TEST UI
  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header
          question={questionIndex + 1}
          total={questions.length}
          progress={progress}
        />

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          {/* QUESTION TIMER */}
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "bold",
              marginBottom: "10px",
              color: questionSecondsLeft <= 2 ? "#ff4444" : "#facc15",
            }}
          >
            Time left: {questionSecondsLeft}s
          </div>

          <div
            style={{
              fontSize: "3.5rem",
              fontWeight: 900,
              color: "#fff",
              marginBottom: "20px",
            }}
          >
            {current.a} × {current.b}
          </div>

          {/* INPUT */}
          <input
            ref={inputRef}
            value={answer}
            disabled={waiting}
            onChange={(e) => setAnswer(e.target.value)}
            style={{
              padding: "12px",
              fontSize: "2rem",
              width: "140px",
              textAlign: "center",
              borderRadius: "50px",
              outline: "none",
              border: "3px solid #facc15",
              background: "#111",
              color: "#fff",
            }}
          />

          {/* BUTTON */}
          <div>
            <button
              onClick={() => submitAnswer(false)}
              disabled={waiting}
              style={{
                marginTop: "20px",
                padding: "12px 30px",
                fontSize: "1.2rem",
                borderRadius: "30px",
                border: "none",
                background: waiting ? "#555" : "#facc15",
                color: waiting ? "#ccc" : "#000",
                cursor: waiting ? "default" : "pointer",
              }}
            >
              {waiting ? "..." : "Submit"}
            </button>
          </div>

          {waiting && (
            <p style={{ marginTop: "10px", color: "#aaa" }}>
              Next question loading…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

const outerStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #facc15, #0f172a 50%, #000)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "20px",
  fontFamily: "Arial",
};

const cardStyle = {
  background: "rgba(0,0,0,0.8)",
  padding: "30px",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "650px",
  color: "white",
  textAlign: "center",
  boxShadow: "0 0 30px rgba(0,0,0,0.7)",
};

function Header({ question, total, progress }) {
  return (
    <div>
      {/* Top */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "15px",
        }}
      >
        <div style={{ fontWeight: "bold", fontSize: "1.3rem" }}>
          Times Tables Arena
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.8rem", color: "#ccc" }}>Question</div>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
            {question}/{total}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "10px",
          background: "#333",
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background:
              "linear-gradient(90deg, #22c55e, #facc15, #f97316, #ef4444)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
