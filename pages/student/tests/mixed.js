import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

const READY_SECONDS = 6;
const GAP_MS = 2000;

export default function MixedTablePage() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]);

  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(0);

  const inputRef = useRef(null);

  // ---------- helpers ----------
  const normaliseClassLabel = (v) =>
    String(v || "").trim().toUpperCase().replace(/\s+/g, "");

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => inputRef.current && inputRef.current.focus(), 10);
    }
  };

  // ---------- load settings from API ----------
  useEffect(() => {
    if (!router.isReady) return;

    const classLabel = normaliseClassLabel(className);
    if (!classLabel) return;

    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/student/settings?class_label=${encodeURIComponent(classLabel)}`
        );
        const data = await res.json();

        if (!res.ok || !data.ok || !data.settings) {
          throw new Error(data?.error || "Could not load settings");
        }

        // sanity bounds
        const qc = Math.max(10, Math.min(60, Number(data.settings.question_count || 25)));
        const spq = Math.max(3, Math.min(6, Number(data.settings.seconds_per_question || 6)));
        const tables =
          Array.isArray(data.settings.tables_selected) && data.settings.tables_selected.length
            ? data.settings.tables_selected.map((n) => Number(n)).filter((n) => n >= 1 && n <= 19)
            : Array.from({ length: 19 }, (_, i) => i + 1);

        const finalSettings = {
          class_label: classLabel,
          question_count: qc,
          seconds_per_question: spq,
          tables_selected: tables,
        };

        setSettings(finalSettings);

        // generate questions once
        const generated = Array.from({ length: qc }).map(() => {
          const a = Math.floor(Math.random() * 12) + 1;
          const b = tables[Math.floor(Math.random() * tables.length)];
          return { a, b, correct: a * b };
        });

        setQuestions(generated);
        setQuestionIndex(0);
        setScore(0);
        setAnswers([]);
      } catch (err) {
        alert("Could not load class settings. Using defaults.");
        const fallback = {
          class_label: normaliseClassLabel(className),
          question_count: 25,
          seconds_per_question: 6,
          tables_selected: Array.from({ length: 19 }, (_, i) => i + 1),
        };
        setSettings(fallback);

        const generated = Array.from({ length: fallback.question_count }).map(() => {
          const a = Math.floor(Math.random() * 12) + 1;
          const b =
            fallback.tables_selected[
              Math.floor(Math.random() * fallback.tables_selected.length)
            ];
          return { a, b, correct: a * b };
        });

        setQuestions(generated);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router.isReady, className]);

  const current = questions[questionIndex];

  // ---------- ready countdown ----------
  useEffect(() => {
    if (loading) return;
    if (showQuestion) return;

    if (readySecondsLeft <= 0) {
      setShowQuestion(true);
      return;
    }

    const t = setTimeout(() => setReadySecondsLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [loading, showQuestion, readySecondsLeft]);

  // reset ready countdown when questions newly created
  useEffect(() => {
    if (!loading && questions.length) {
      setReadySecondsLeft(READY_SECONDS);
      setShowQuestion(false);
    }
  }, [loading, questions.length]);

  // ---------- focus when active ----------
  useEffect(() => {
    if (showQuestion && !waiting) focusInput();
  }, [showQuestion, waiting, questionIndex]);

  // ---------- per-question timer + auto advance ----------
  useEffect(() => {
    if (!showQuestion) return;
    if (waiting) return;
    if (!current) return;
    if (!settings) return;

    const seconds = Number(settings.seconds_per_question || 6);
    setQuestionSecondsLeft(seconds);

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          submitAnswer(true); // auto submit on time-out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, showQuestion, waiting, current, settings]);

  // ---------- Enter submits ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && showQuestion && !waiting) {
        submitAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuestion, waiting, answer, current]);

  const finishAndSave = async (finalScore, finalAnswers) => {
    try {
      const res = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeof name === "string" ? decodeURIComponent(name) : "",
          className: typeof className === "string" ? decodeURIComponent(className) : "",
          score: finalScore,
          total: questions.length,
          questionTime: settings?.seconds_per_question ?? 6,
          tablesUsed: Array.from(new Set(questions.map((q) => q.b))),
          questions: finalAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert("Save failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Save failed: " + (err?.message || err));
    }

    router.push(
      `/student/tests/result?score=${finalScore}&total=${questions.length}&name=${encodeURIComponent(
        name || ""
      )}&class=${encodeURIComponent(className || "")}`
    );
  };

  const submitAnswer = (auto = false) => {
    if (waiting || !current) return;

    const parsed = answer === "" || answer === null ? null : parseInt(answer, 10);
    const isCorrect = !auto && parsed === current.correct;

    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(newScore);

    const questionResult = {
      a: current.a,
      b: current.b,
      correct_answer: current.correct,
      student_answer: auto ? null : parsed,
      is_correct: isCorrect, // ✅ matches your schema naming
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
    }, GAP_MS);
  };

  // ---------- UI ----------
  if (loading || !settings || !questions.length) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header />
          <p style={{ marginTop: "1.5rem", color: "#e5e7eb" }}>Loading test…</p>
        </div>
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
            <div style={{ color: "#0f172a", letterSpacing: "0.2em" }}>GET READY…</div>
            <div style={readyNumberStyle(readySecondsLeft)}>{readySecondsLeft}</div>
            <p style={{ marginTop: "0.5rem", color: "#334155" }}>
              Test starts in <strong>{readySecondsLeft}</strong> seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progress = (questionIndex + 1) / questions.length;
  const timeBarPct =
    settings.seconds_per_question > 0
      ? (questionSecondsLeft / settings.seconds_per_question) * 100
      : 0;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header
          question={questionIndex + 1}
          total={questions.length}
          progress={progress}
        />

        {/* time bar */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
            Time left: {questionSecondsLeft}s
          </div>
          <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max(0, Math.min(100, timeBarPct))}%`,
                background: questionSecondsLeft <= 2 ? "#f97316" : "#22c55e",
                transition: "width 0.25s linear",
              }}
            />
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <div style={{ color: "#475569", marginBottom: "0.5rem" }}>
            Question {questionIndex + 1} of {questions.length}
          </div>

          <div style={questionStyle}>
            {current.a} × {current.b}
          </div>

          <div style={{ marginTop: "0.5rem", fontSize: "1.5rem", color: "#0f172a" }}>=</div>

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

          {waiting && (
            <p style={{ marginTop: "0.5rem", color: "#64748b" }}>
              Next question…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles (white / slick) ---------- */

const outerStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "#0f172a",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  background: "white",
  borderRadius: "22px",
  padding: "2rem 2.5rem",
  maxWidth: "740px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(15, 23, 42, 0.12)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
};

const questionStyle = {
  fontSize: "3.6rem",
  fontWeight: 900,
  color: "#0f172a",
};

const inputStyle = {
  marginTop: "0.75rem",
  padding: "14px",
  fontSize: "1.75rem",
  width: "170px",
  textAlign: "center",
  borderRadius: "999px",
  border: "2px solid #0ea5e9",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  outline: "none",
  boxShadow: "0 8px 20px rgba(14, 165, 233, 0.15)",
};

const buttonStyle = (waiting) => ({
  padding: "12px 28px",
  fontSize: "1.05rem",
  fontWeight: 800,
  borderRadius: "999px",
  border: "none",
  background: waiting ? "#cbd5e1" : "linear-gradient(135deg,#0ea5e9,#22c55e)",
  color: "#0f172a",
  cursor: waiting ? "default" : "pointer",
});

const readyNumberStyle = (n) => ({
  fontSize: "4.5rem",
  fontWeight: 900,
  marginTop: "0.75rem",
  color: n <= 2 ? "#f97316" : "#0ea5e9",
});

/* ---------- Header ---------- */

function Header({ question, total, progress }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "50%",
              background: "linear-gradient(135deg,#0ea5e9,#22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 900,
            }}
          >
            BM
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", letterSpacing: "0.12em" }}>
              BUSHEY MANOR
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0f172a" }}>
              Times Tables Arena
            </div>
          </div>
        </div>

        {typeof question === "number" && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>Question</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div style={{ marginTop: "1rem", height: "10px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              height: "100%",
              background: "linear-gradient(90deg,#0ea5e9,#22c55e,#f97316)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
      )}
    </div>
  );
}
