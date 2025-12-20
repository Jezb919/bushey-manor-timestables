import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

const READY_SECONDS_DEFAULT = 6;

// This MUST match teacher page
const SETTINGS_KEY = "bmtt_teacher_settings_v2";

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseTablesParam(str) {
  if (!str) return null;
  const parts = String(str)
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19);
  return parts.length ? Array.from(new Set(parts)).sort((a, b) => a - b) : null;
}

function getSettingsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const questionCount = clampNumber(parsed.questionCount, 10, 60, 25);
    const secondsPerQuestion = clampNumber(parsed.secondsPerQuestion, 3, 6, 6);
    const tablesIncluded = Array.isArray(parsed.tablesIncluded)
      ? parsed.tablesIncluded
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19)
      : null;

    return {
      questionCount,
      secondsPerQuestion,
      tablesIncluded: tablesIncluded && tablesIncluded.length ? tablesIncluded : null,
    };
  } catch {
    return null;
  }
}

export default function MixedTablePage() {
  const router = useRouter();
  const { name, class: className } = router.query;

  // Settings (loaded from URL first, else localStorage, else defaults)
  const [questionCount, setQuestionCount] = useState(25);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(6);
  const [tablesIncluded, setTablesIncluded] = useState(
    Array.from({ length: 12 }, (_, i) => i + 1) // default 1–12
  );

  // Test state
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  const [showQuestion, setShowQuestion] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS_DEFAULT);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(6);

  const [answersLog, setAnswersLog] = useState([]);

  const inputRef = useRef(null);

  // Track per-question timing
  const questionStartMsRef = useRef(null);

  const decodedName = useMemo(() => {
    if (typeof name !== "string") return "";
    try {
      return decodeURIComponent(name);
    } catch {
      return String(name);
    }
  }, [name]);

  const decodedClass = useMemo(() => {
    if (typeof className !== "string") return "";
    try {
      return decodeURIComponent(className);
    } catch {
      return String(className);
    }
  }, [className]);

  // Load settings once router is ready (so router.query exists)
  useEffect(() => {
    if (!router.isReady) return;

    // 1) Try URL params
    const qcFromUrl = clampNumber(router.query.qc, 10, 60, NaN);
    const secFromUrl = clampNumber(router.query.sec, 3, 6, NaN);
    const tablesFromUrl = parseTablesParam(router.query.tables);

    const hasUrlSettings =
      Number.isFinite(qcFromUrl) || Number.isFinite(secFromUrl) || !!tablesFromUrl;

    if (hasUrlSettings) {
      const qc = Number.isFinite(qcFromUrl) ? qcFromUrl : 25;
      const sec = Number.isFinite(secFromUrl) ? secFromUrl : 6;
      const tbl = tablesFromUrl || Array.from({ length: 12 }, (_, i) => i + 1);

      setQuestionCount(qc);
      setSecondsPerQuestion(sec);
      setTablesIncluded(tbl);
      setQuestionSecondsLeft(sec);
      return;
    }

    // 2) Try teacher browser localStorage (same device)
    if (typeof window !== "undefined") {
      const local = getSettingsFromLocalStorage();
      if (local) {
        setQuestionCount(local.questionCount ?? 25);
        setSecondsPerQuestion(local.secondsPerQuestion ?? 6);
        setTablesIncluded(local.tablesIncluded ?? Array.from({ length: 12 }, (_, i) => i + 1));
        setQuestionSecondsLeft(local.secondsPerQuestion ?? 6);
        return;
      }
    }

    // 3) Defaults already set
    setQuestionSecondsLeft(6);
  }, [router.isReady, router.query]);

  // Generate questions whenever settings are ready/changed
  useEffect(() => {
    if (!tablesIncluded || !tablesIncluded.length) return;

    const generated = Array.from({ length: questionCount }).map(() => {
      const a = Math.floor(Math.random() * 12) + 1;
      const b = tablesIncluded[Math.floor(Math.random() * tablesIncluded.length)];
      return { a, b, correct: a * b };
    });

    setQuestions(generated);

    // Reset whole run if settings change
    setQuestionIndex(0);
    setScore(0);
    setAnswer("");
    setAnswersLog([]);
    setWaiting(false);
    setShowQuestion(false);
    setReadySecondsLeft(READY_SECONDS_DEFAULT);
  }, [questionCount, tablesIncluded]);

  const current = questions[questionIndex];

  // Ready countdown 6..1 then show questions
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
    if (!inputRef.current) return;
    inputRef.current.focus();
    // extra little nudge for mobile
    setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
  };

  // Focus when test starts / question changes / waiting ends
  useEffect(() => {
    if (showQuestion && !waiting) focusInput();
  }, [showQuestion, waiting, questionIndex]);

  // Per-question timer + auto-advance
  useEffect(() => {
    if (!showQuestion) return;
    if (waiting) return;
    if (!current) return;

    // reset timer
    setQuestionSecondsLeft(secondsPerQuestion);
    questionStartMsRef.current = Date.now();

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // time up -> auto submit
          submitAnswer({ auto: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, showQuestion, waiting, current, secondsPerQuestion]);

  // Enter submits (manual)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter" && showQuestion && !waiting) {
        submitAnswer({ auto: false });
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
          name: decodedName,
          className: decodedClass,
          score: finalScore,
          total: questions.length,
          questionTime: secondsPerQuestion,
          tablesUsed: Array.from(new Set(questions.map((q) => q.b))).sort((a, b) => a - b),
          settings: {
            questionCount,
            secondsPerQuestion,
            tablesIncluded,
          },
          questions: finalAnswers,
          started_at: finalAnswers?.[0]?.started_at || null,
          finished_at: new Date().toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert("Save failed: " + (data.error || data.details || "Unknown error"));
      }
    } catch (err) {
      alert("Save failed: " + (err?.message || String(err)));
    }

    router.push(
      `/student/tests/result?score=${finalScore}&total=${questions.length}&name=${encodeURIComponent(
        decodedName
      )}&class=${encodeURIComponent(decodedClass)}`
    );
  };

  const submitAnswer = ({ auto }) => {
    if (waiting || !current) return;

    // how long they took (ms)
    const startedMs = questionStartMsRef.current || Date.now();
    const responseTimeMs = Date.now() - startedMs;

    // parse answer
    const raw = String(answer || "").trim();
    const parsed = raw === "" ? null : Number.parseInt(raw, 10);

    // If auto=true -> treat as no answer, not correct
    const isCorrect = !auto && parsed !== null && parsed === current.correct;
    const newScore = isCorrect ? score + 1 : score;

    // log question record
    const record = {
      a: current.a,
      b: current.b,
      table_num: current.b,
      correct_answer: current.correct,
      student_answer: auto ? null : parsed,
      is_correct: isCorrect,
      auto_timeout: auto,
      response_time_ms: responseTimeMs,
      started_at: new Date(startedMs).toISOString(),
      finished_at: new Date().toISOString(),
    };

    // Clear input immediately + lock
    setAnswer("");
    setWaiting(true);

    // update score safely
    if (isCorrect) setScore(newScore);

    // Add record and move on after gap
    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        setAnswersLog((prev) => [...prev, record]);
        setQuestionIndex((prev) => prev + 1);
      } else {
        const all = [...answersLog, record];
        finishAndSave(newScore, all);
      }
    }, 2000);
  };

  // Loading (questions not ready)
  if (!questions.length) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header />
          <p style={{ color: "#6B7280", marginTop: 14 }}>Loading questions…</p>
        </div>
      </div>
    );
  }

  // Ready screen
  if (!showQuestion) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <Header />

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <div style={kickerStyle}>Get Ready…</div>
            <div style={readyNumberStyle(readySecondsLeft)}>{readySecondsLeft}</div>
            <p style={{ marginTop: "0.5rem", color: "#6B7280" }}>
              Test starts in <strong>{readySecondsLeft}</strong> seconds.
            </p>

            <div style={miniPillRow}>
              <span style={miniPill}>
                {questionCount} questions
              </span>
              <span style={miniPill}>
                {secondsPerQuestion}s each
              </span>
              <span style={miniPill}>
                Tables: {tablesIncluded.join(", ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = (questionIndex + 1) / questions.length;

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <Header question={questionIndex + 1} total={questions.length} progress={progress} />

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <div
            style={{
              fontSize: "1.05rem",
              fontWeight: 900,
              marginBottom: "0.4rem",
              color: questionSecondsLeft <= 2 ? "#DC2626" : "#2563EB",
            }}
          >
            Time left: {questionSecondsLeft}s
          </div>

          {/* time bar */}
          <div style={timeBarWrap}>
            <div
              style={{
                ...timeBarFill,
                width: `${Math.max(
                  0,
                  Math.min(100, (questionSecondsLeft / secondsPerQuestion) * 100)
                )}%`,
              }}
            />
          </div>

          <div style={{ color: "#6B7280", marginTop: 10 }}>
            Question {questionIndex + 1} of {questions.length}
          </div>

          <div style={questionStyle}>
            {current.a} × {current.b}
          </div>

          <div style={{ marginTop: "0.5rem", fontSize: "1.5rem", color: "#111827" }}>=</div>

          <input
            ref={inputRef}
            value={answer}
            disabled={waiting}
            onChange={(e) => setAnswer(e.target.value)}
            style={inputStyle}
            inputMode="numeric"
            pattern="[0-9]*"
          />

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={() => submitAnswer({ auto: false })}
              disabled={waiting}
              style={buttonStyle(waiting)}
            >
              {waiting ? "Next…" : "Submit"}
            </button>
          </div>

          {waiting && (
            <p style={{ marginTop: "0.5rem", color: "#6B7280" }}>
              Next question…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- UI ---------- */

function Header({ question, total, progress }) {
  return (
    <div>
      <div style={topRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={logo}>BM</div>
          <div>
            <div style={kickerStyle}>Bushey Manor</div>
            <div style={titleStyle}>Times Tables Arena</div>
          </div>
        </div>

        {typeof question === "number" && (
          <div style={{ textAlign: "right" }}>
            <div style={{ ...kickerStyle, marginBottom: 2 }}>Question</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 1000 }}>
              {question} / {total}
            </div>
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div style={progressWrap}>
          <div style={{ ...progressFill, width: `${Math.min(progress * 100, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

const outerStyle = {
  minHeight: "100vh",
  background: "#F7F7FB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "#111827",
  fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
};

const cardStyle = {
  background: "white",
  borderRadius: "18px",
  padding: "1.6rem 1.8rem",
  maxWidth: "720px",
  width: "100%",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
  border: "1px solid #E5E7EB",
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const logo = {
  width: 54,
  height: 54,
  borderRadius: 999,
  background: "#FACC15",
  border: "1px solid #E5E7EB",
  display: "grid",
  placeItems: "center",
  fontWeight: 1000,
};

const kickerStyle = {
  fontSize: "0.78rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#6B7280",
  fontWeight: 900,
};

const titleStyle = {
  fontSize: "1.25rem",
  fontWeight: 1000,
};

const progressWrap = {
  marginTop: 12,
  height: 10,
  borderRadius: 999,
  background: "#EEF2FF",
  overflow: "hidden",
  border: "1px solid #E5E7EB",
};

const progressFill = {
  height: "100%",
  background: "linear-gradient(90deg,#22C55E,#2563EB,#F59E0B)",
  transition: "width 0.25s ease-out",
};

const questionStyle = {
  fontSize: "3.5rem",
  fontWeight: 1000,
  marginTop: 14,
};

const inputStyle = {
  marginTop: "0.85rem",
  padding: "14px",
  fontSize: "1.75rem",
  width: "180px",
  textAlign: "center",
  borderRadius: "999px",
  border: "2px solid #2563EB",
  backgroundColor: "#FFFFFF",
  color: "#111827",
  outline: "none",
};

const buttonStyle = (waiting) => ({
  padding: "12px 28px",
  fontSize: "1.05rem",
  fontWeight: 1000,
  borderRadius: "999px",
  border: "none",
  background: waiting ? "#9CA3AF" : "linear-gradient(135deg,#2563EB,#60A5FA)",
  color: "white",
  cursor: waiting ? "default" : "pointer",
});

const readyNumberStyle = (n) => ({
  fontSize: "4.5rem",
  fontWeight: 1000,
  marginTop: "0.75rem",
  color: n <= 2 ? "#DC2626" : "#2563EB",
});

const miniPillRow = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  justifyContent: "center",
  flexWrap: "wrap",
};

const miniPill = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #E5E7EB",
  background: "#F8FAFC",
  fontWeight: 900,
  color: "#374151",
};

const timeBarWrap = {
  margin: "0 auto",
  width: "320px",
  maxWidth: "100%",
  height: 10,
  borderRadius: 999,
  background: "#F3F4F6",
  overflow: "hidden",
  border: "1px solid #E5E7EB",
};

const timeBarFill = {
  height: "100%",
  background: "linear-gradient(90deg,#22C55E,#F59E0B,#DC2626)",
  transition: "width 0.25s linear",
};
