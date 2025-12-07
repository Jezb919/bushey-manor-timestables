import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

const TOTAL_QUESTIONS = 25;
const READY_SECONDS = 6;

export default function MixedTablePage() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);

  const inputRef = useRef(null);

  // All tables allowed for now (later controlled by teacher settings)
  const allowedTables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Generate mixed questions ONCE
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

  // 6-second visible countdown before test starts
  useEffect(() => {
    if (showQuestion) return;

    if (readySecondsLeft <= 0) {
      setShowQuestion(true);
      return;
    }

    const timer = setTimeout(
      () => setReadySecondsLeft((prev) => prev - 1),
      1000
    );
    return () => clearTimeout(timer);
  }, [readySecondsLeft, showQuestion]);

  // Strong autofocus helper for the answer box
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 10);
    }
  };

  // Focus when a new question appears / gap ends / test starts
  useEffect(() => {
    if (showQuestion && !waiting) {
      focusInput();
    }
  }, [questionIndex, waiting, showQuestion]);

  // ENTER key submits answer
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

    const isCorrect = parseInt(answer) === current.correct;
    const newScore = isCorrect ? score + 1 : score;

    if (isCorrect) setScore(newScore);

    setAnswer("");
    setWaiting(true);

    // 2-second gap before next question
    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setQuestionIndex((prev) => prev + 1);
      } else {
        // Go to result page – name & class are passed along
        router.push(
          `/student/tests/result?score=${newScore}&total=${
            questions.length
          }&name=${encodeURIComponent(name || "")}&class=${encodeURIComponent(
            className || ""
          )}`
        );
      }
    }, 2000);
  };

  // Loading state while questions are being generated
  if (!questions.length) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  /* ---------------- READY SCREEN ------------------ */
  if (!showQuestion) {
    const danger = readySecondsLeft <= 2;
    const countdownStyle = {
      fontSize: "4.5rem",
      fontWeight: 800,
      marginTop: "0.75rem",
      color: danger ? "#f97316" : "#facc15",
      textShadow: "0 0 20px rgba(250,204,21,0.7)",
      transform: danger ? "scale(1.15)" : "scale(1.0)",
      transition: "all 0.2s ease",
    };

    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header />
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <div style={{ color: "#e5e7eb", letterSpacing: "0.2em" }}>
              Get Ready…
            </div>
            <div style={countdownStyle}>{readySecondsLeft}</div>
            <p style={{ marginTop: "0.5rem", color: "#d1d5db" }}>
              Your mixed times tables test starts in{" "}
              <strong>{readySecondsLeft}</strong> seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- MAIN TEST SCREEN ------------------ */

  const progress = (questionIndex + 1) / questions.length;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header
          question={questionIndex + 1}
          total={questions.length}
          progress={progress}
        />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <div style={{ color: "#9ca3af", marginBottom: "0.5rem" }}>
            Question {questionIndex + 1} of {questions.length}
          </div>

          <div style={questionStyle}>
            {current.a} × {current.b}
          </div>

          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "1.5rem",
              color: "#e5e7eb",
            }}
          >
            =
          </div>

          <input
            ref={inputRef}
            value={answer}
            disabled={waiting}
            onChange={(e) => setAnswer(e.target.value)}
            style={inputStyle}
          />

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={submitAnswer}
              disabled={waiting}
              style={buttonStyle(waiting)}
            >
              {waiting ? "Next…" : "Submit"}
            </button>
          </div>

          {waiting && (
            <p style={{ marginTop: "0.5rem", color: "#9ca3af" }}>
              Next question…
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
};

const cardStyle = {
  background: "rgba(3,7,18,0.9)",
  borderRadius: "22px",
  padding: "2rem 2.5rem",
  maxWidth: "700px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
  border: "1px solid rgba(148,163,184,0.3)",
};

const questionStyle = {
  fontSize: "3.5rem",
  fontWeight: 800,
  color: "#f9fafb",
  textShadow: "0 0 20px rgba(0,0,0,0.7)",
};

const inputStyle = {
  marginTop: "0.75rem",
  padding: "14px",
  fontSize: "1.75rem",
  width: "170px",
  textAlign: "center",
  borderRadius: "999px",
  border: "2px solid #facc15",
  backgroundColor: "#020617",
  color: "white",
  outline: "none",
};

const buttonStyle = (waiting) => ({
  padding: "12px 28px",
  fontSize: "1.1rem",
  fontWeight: 700,
  borderRadius: "999px",
  background: waiting
    ? "#4b5563"
    : "linear-gradient(135deg,#f59e0b,#facc15)",
  color: waiting ? "#e5e7eb" : "#111827",
  cursor: waiting ? "default" : "pointer",
});

/* ---------- Header Component ---------- */

function Header({ question, total, progress }) {
  return (
    <div>
      {/* Top Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "white",
              border: "3px solid #facc15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Placeholder for logo */}
            <span
              style={{
                fontWeight: 800,
                fontSize: "1.3rem",
                color: "#0f172a",
              }}
            >
              BM
            </span>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#e5e7eb" }}>
              Bushey Manor
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: "bold",
                color: "#facc15",
              }}
            >
              Times Tables Arena
            </div>
          </div>
        </div>

        {question && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
              Question
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {typeof progress === "number" && (
        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "#0f172a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background:
                "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      )}
    </div>
  );
}
