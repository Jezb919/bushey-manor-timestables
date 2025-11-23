import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

const TOTAL_QUESTIONS = 25;
const READY_SECONDS = 6;

export default function MixedTest() {
  const router = useRouter();

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);

  // Input ref for autofocus
  const inputRef = useRef(null);

  // Allowed tables – later this will come from teacher settings
  const allowedTables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Generate mixed questions once
  useEffect(() => {
    const generated = Array.from({ length: TOTAL_QUESTIONS }).map(() => {
      const a = Math.floor(Math.random() * 12) + 1;
      const b =
        allowedTables[Math.floor(Math.random() * allowedTables.length)];
      return {
        a,
        b,
        correct: a * b,
      };
    });

    setQuestions(generated);
  }, []);

  const current = questions[questionIndex];

  // 6-second ready countdown
  useEffect(() => {
    if (readySecondsLeft <= 0) {
      setShowQuestion(true);
      return;
    }

    const interval = setInterval(() => {
      setReadySecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [readySecondsLeft]);

  // Strong autofocus helper
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        inputRef.current && inputRef.current.focus();
      }, 10);
    }
  };

  // Focus when a new question appears or after the gap
  useEffect(() => {
    if (showQuestion && !waiting) {
      focusInput();
    }
  }, [questionIndex, waiting, showQuestion]);

  // ENTER submits answer
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !waiting && showQuestion) {
      submitAnswer();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const submitAnswer = () => {
    if (waiting || !current) return;

    if (parseInt(answer) === current.correct) {
      setScore((prev) => prev + 1);
    }

    setAnswer("");
    setWaiting(true);

    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setQuestionIndex((prev) => prev + 1);
      } else {
        router.push(
          `/student/tests/result?score=${score + 1}&total=${questions.length}`
        );
      }
    }, 2000);
  };

  // Loading state
  if (!questions.length) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: "1.25rem" }}>Loading questions…</p>
        </div>
      </div>
    );
  }

  // READY SCREEN with countdown
  if (!showQuestion) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header question={null} total={TOTAL_QUESTIONS} />
          <div
            style={{
              textAlign: "center",
              marginTop: "1.5rem",
              padding: "1.5rem 0",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#e5e7eb",
              }}
            >
              Get Ready…
            </div>
            <div
              style={{
                fontSize: "4rem",
                fontWeight: 800,
                marginTop: "0.5rem",
                color: "#facc15",
                textShadow: "0 0 12px rgba(250,204,21,0.5)",
              }}
            >
              {readySecondsLeft}
            </div>
            <p
              style={{
                marginTop: "0.5rem",
                color: "#d1d5db",
                fontSize: "0.95rem",
              }}
            >
              Your mixed times tables test will start in{" "}
              <strong>{readySecondsLeft}</strong> seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN TEST SCREEN
  const progress = (questionIndex + 1) / questions.length;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header
          question={questionIndex + 1}
          total={questions.length}
          progress={progress}
        />

        {/* Question */}
        <div
          style={{
            marginTop: "1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: "0.4rem",
            }}
          >
            Question {questionIndex + 1} of {questions.length}
          </div>

          <div
            style={{
              fontSize: "3.5rem",
              fontWeight: 800,
              color: "#f9fafb",
              textShadow: "0 0 20px rgba(0,0,0,0.7)",
            }}
          >
            {current.a} × {current.b}
          </div>

          <div
            style={{
              fontSize: "1.5rem",
              marginTop: "0.75rem",
              color: "#e5e7eb",
            }}
          >
            =
          </div>

          {/* Answer input */}
          <div style={{ marginTop: "0.75rem" }}>
            <input
              ref={inputRef}
              value={answer}
              disabled={waiting}
              onChange={(e) => setAnswer(e.target.value)}
              style={{
                padding: "14px 18px",
                fontSize: "1.5rem",
                width: "160px",
                textAlign: "center",
                borderRadius: "999px",
                border: "2px solid #facc15",
                outline: "none",
                backgroundColor: "#020617",
                color: "#f9fafb",
                boxShadow: "0 0 10px rgba(250,204,21,0.4)",
              }}
            />
          </div>

          {/* Submit button */}
          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={submitAnswer}
              disabled={waiting}
              style={{
                padding: "12px 28px",
                fontSize: "1.1rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                borderRadius: "999px",
                border: "none",
                cursor: waiting ? "default" : "pointer",
                background: waiting
                  ? "#4b5563"
                  : "linear-gradient(135deg,#f59e0b,#facc15)",
                color: waiting ? "#e5e7eb" : "#111827",
                boxShadow: waiting
                  ? "none"
                  : "0 0 18px rgba(250,204,21,0.5)",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
            >
              {waiting ? "Next…" : "Submit"}
            </button>
          </div>

          {waiting && (
            <p
              style={{
                marginTop: "0.5rem",
                color: "#9ca3af",
                fontSize: "0.9rem",
              }}
            >
              Next question loading…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared Layout Styles ---------- */

const outerStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "white",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  background: "rgba(3,7,18,0.95)",
  borderRadius: "20px",
  padding: "1.75rem 2.25rem",
  maxWidth: "680px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
  border: "1px solid rgba(148,163,184,0.3)",
};

/* ---------- Header Component ---------- */

function Header({ question, total, progress }) {
  return (
    <div>
      {/* Top row: logo + title + score/progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "999px",
              background: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: "2px solid #facc15",
            }}
          >
            <img
              src="/bushey-logo.png"
              alt="Bushey Manor Junior School"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#e5e7eb",
              }}
            >
              Bushey Manor
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "#facc15",
              }}
            >
              Times Tables Arena
            </div>
          </div>
        </div>

        {/* Question counter */}
        {typeof question === "number" && total && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#9ca3af",
              }}
            >
              Question
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#e5e7eb",
              }}
            >
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {typeof progress === "number" && (
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "#020617",
              overflow: "hidden",
              boxShadow: "0 0 10px rgba(15,23,42,0.8)",
            }}
          >
            <div
              style={{
                width: `${Math.min(progress * 100, 100)}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
                transition: "width 0.25s ease-out",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
