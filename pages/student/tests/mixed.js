import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

const TOTAL_QUESTIONS = 3; // keep 3 while testing saving
const READY_SECONDS = 6;
const QUESTION_SECONDS = 6;

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
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(QUESTION_SECONDS);

  const [answers, setAnswers] = useState([]);

  const inputRef = useRef(null);

  // All tables allowed for now
  const allowedTables = [1,2,3,4,5,6,7,8,9,10,11,12];

  // Generate questions once
  useEffect(() => {
    const generated = Array.from({ length: TOTAL_QUESTIONS }).map(() => {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = allowedTables[Math.floor(Math.random() * allowedTables.length)];
      return { a, b, correct: a * b };
    });
    setQuestions(generated);
  }, []);

  const current = questions[questionIndex];

  // Ready countdown 6..1
  useEffect(() => {
    if (showQuestion) return;

    if (readySecondsLeft <= 0) {
      setShowQuestion(true);
      return;
    }

    const t = setTimeout(() => setReadySecondsLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [readySecondsLeft, showQuestion]);

  // Focus helper
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => inputRef.current && inputRef.current.focus(), 10);
    }
  };

  useEffect(() => {
    if (showQuestion && !waiting) focusInput();
  }, [showQuestion, waiting, questionIndex]);

  // Per-question timer + auto advance
  useEffect(() => {
    if (!showQuestion) return;
    if (waiting) return;
    if (!current) return;

    setQuestionSecondsLeft(QUESTION_SECONDS);

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitAnswer(true); // auto = time up
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, showQuestion, waiting, current]);

  // Enter submits
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && showQuestion && !waiting) {
        submitAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuestion, waiting, answer, current, questionIndex, score, answers]);

  const finishAndSave = async (finalScore, finalAnswers) => {
    // Call server API to save everything (student + test + questions)
    try {
      const res = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeof name === "string" ? decodeURIComponent(name) : "",
          className: typeof className === "string" ? decodeURIComponent(className) : "",
          score: finalScore,
          total: questions.length,
          questionTime: QUESTION_SECONDS,
          tablesUsed: Array.from(new Set(questions.map((q) => q.b))),
          questions: finalAnswers,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert("Save failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Save failed: " + err.message);
    }

    router.push(
      `/student/tests/result?score=${finalScore}&total=${questions.length}&name=${encodeURIComponent(
        name || ""
      )}&class=${encodeURIComponent(className || "")}`
    );
  };

  const submitAnswer = (auto = false) => {
    if (waiting || !current) return;

    const parsed =
      answer === "" || answer === null ? null : parseInt(answer, 10);

    const isCorrect = !auto && parsed === current.correct;
    const newScore = isCorrect ? score + 1 : score;

    if (isCorrect) setScore(newScore);

    const questionResult = {
      a: current.a,
      b: current.b,
      correct_answer: current.correct,
      student_answer: auto ? null : parsed,
      was_correct: isCorrect,
    };

    setAnswer("");
    setWaiting(true);

    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setAnswers((prev) => [...prev, questionResult]);
        setQuestionIndex((prev) => prev + 1);
      } else {
        const all = [...answers, questionResult];
        finishAndSave(newScore, all);
      }
    }, 2000);
  };

  if (!questions.length) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}><p>Loading…</p></div>
      </div>
    );
  }

  // READY SCREEN
  if (!showQuestion) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header />
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <div style={{ color: "#e5e7eb", letterSpacing: "0.2em" }}>Get Ready…</div>
            <div style={readyNumberStyle(readySecondsLeft)}>{readySecondsLeft}</div>
            <p style={{ marginTop: "0.5rem", color: "#d1d5db" }}>
              Test starts in <strong>{readySecondsLeft}</strong> seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // MAIN
  const progress = (questionIndex + 1) / questions.length;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header question={questionIndex + 1} total={questions.length} progress={progress} />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: "0.4rem",
              color: questionSecondsLeft <= 2 ? "#f97316" : "#facc15",
            }}
          >
            Time left: {questionSecondsLeft}s
          </div>

          <div style={{ color: "#9ca3af", marginBottom: "0.5rem" }}>
            Question {questionIndex + 1} of {questions.length}
          </div>

          <div style={questionStyle}>{current.a} × {current.b}</div>
          <div style={{ marginTop: "0.5rem", fontSize: "1.5rem", color: "#e5e7eb" }}>=</div>

          <input
            ref={inputRef}
            value={answer}
            disabled={waiting}
            onChange={(e) => setAnswer(e.target.value)}
            style={inputStyle}
          />

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={() => submitAnswer(false)}
              disabled={waiting}
              style={buttonStyle(waiting)}
            >
              {waiting ? "Next…" : "Submit"}
            </button>
          </div>

          {waiting && <p style={{ marginTop: "0.5rem", color: "#9ca3af" }}>Next question…</p>}
        </div>
      </div>
    </div>
  );
}

const outerStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
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
  background: waiting ? "#4b5563" : "linear-gradient(135deg,#f59e0b,#facc15)",
  color: waiting ? "#e5e7eb" : "#111827",
  cursor: waiting ? "default" : "pointer",
});

const readyNumberStyle = (n) => ({
  fontSize: "4.5rem",
  fontWeight: 900,
  marginTop: "0.75rem",
  color: n <= 2 ? "#f97316" : "#facc15",
  textShadow: "0 0 20px rgba(250,204,21,0.7)",
});

function Header({ question, total, progress }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <span style={{ fontWeight: 900, fontSize: "1.3rem", color: "#0f172a" }}>BM</span>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#e5e7eb" }}>Bushey Manor</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#facc15" }}>
              Times Tables Arena
            </div>
          </div>
        </div>

        {typeof question === "number" && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Question</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div style={{ marginTop: "1rem", height: "8px", borderRadius: "999px", background: "#0f172a", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              height: "100%",
              background: "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      )}
    </div>
  );
}
