import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function MixedTest() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Timer UI
  const [timeLeft, setTimeLeft] = useState(0);
  const [pauseBetween, setPauseBetween] = useState(false);

  // Refs (so we never lose data)
  const startedAtRef = useRef(null);
  const questionStartRef = useRef(null);
  const answersRef = useRef([]);

  const timerIntervalRef = useRef(null);
  const pauseTimeoutRef = useRef(null);

  const minT = useMemo(() => Number(settings?.minimum_table ?? 1), [settings]);
  const maxT = useMemo(() => Number(settings?.maximum_table ?? 12), [settings]);

  const questionCount = useMemo(() => {
    const n = Number(settings?.question_count ?? settings?.num_questions ?? 25);
    return Number.isFinite(n) ? Math.max(10, Math.min(60, Math.trunc(n))) : 25;
  }, [settings]);

  const secondsPerQuestion = useMemo(() => {
    const s = Number(settings?.seconds_per_question ?? 6);
    return [3, 6, 9, 12].includes(s) ? s : 6;
  }, [settings]);

  function clearTimers() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = null;
  }

  function startTimer() {
    clearTimers();
    setPauseBetween(false);
    setTimeLeft(secondsPerQuestion);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimers();
          // Auto-next after 1 second pause
          setPauseBetween(true);
          pauseTimeoutRef.current = setTimeout(() => {
            setPauseBetween(false);
            onNext(true); // auto = true
          }, 1000);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setLoading(true);
        setError("");

        const sRes = await fetch("/api/student/session");
        const sJson = await sRes.json();
        if (!sJson?.signedIn) {
          router.push("/student/login");
          return;
        }

        const setRes = await fetch("/api/student/settings");
        const setJson = await setRes.json();
        if (!setJson?.settings) {
          if (mounted) {
            setError("Could not load class settings.");
            setLoading(false);
          }
          return;
        }

        // Block if start date is in the future
        if (setJson.settings.test_start_date) {
          const start = new Date(setJson.settings.test_start_date);
          if (!isNaN(start.getTime()) && start.getTime() > Date.now()) {
            if (mounted) {
              setSettings(setJson.settings);
              setQuestions([]);
              setLoading(false);
              setError("Test not available yet (check class start date).");
            }
            return;
          }
        }

        const cls = setJson.settings;
        const minTable = Number(cls.minimum_table ?? 1);
        const maxTable = Number(cls.maximum_table ?? 12);
        const qCount = Number(cls.question_count ?? cls.num_questions ?? 25);

        const qs = Array.from({ length: qCount }).map(() => {
          const a = randInt(minTable, maxTable);
          const b = randInt(2, 12);
          return { a, b, expected: a * b, table_number: a };
        });

        if (!mounted) return;

        setSettings(cls);
        setQuestions(qs);
        setIdx(0);
        setAnswer("");
        setCorrectCount(0);
        setFinished(false);

        answersRef.current = [];
        startedAtRef.current = new Date();
        questionStartRef.current = performance.now();

        setLoading(false);
      } catch {
        if (mounted) {
          setError("Failed to load test.");
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      mounted = false;
      clearTimers();
    };
  }, [router]);

  // Start timer whenever a new question appears
  useEffect(() => {
    if (!loading && !error && !finished && questions.length) {
      startTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loading, error, finished, questions.length, secondsPerQuestion]);

  async function submitResult() {
    const finishedAt = new Date();
    const payload = {
      test_type: "mixed",
      started_at: startedAtRef.current?.toISOString?.() || null,
      finished_at: finishedAt.toISOString(),
      answers: answersRef.current,
    };

    const r = await fetch("/api/tests/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);
    // eslint-disable-next-line no-console
    console.log("Submit response:", r.status, j);

    if (!r.ok) setError(j?.error || "Submit failed");
  }

  function onNext(auto = false) {
    if (finished) return;
    if (pauseBetween && !auto) return; // don’t allow click during the 1s pause

    clearTimers();

    const q = questions[idx];
    if (!q) return;

    const given = answer === "" ? null : Number(answer);
    const isCorrect =
      given !== null && !Number.isNaN(given) && given === q.expected;

    const now = performance.now();
    const responseMs =
      questionStartRef.current != null
        ? Math.round(now - questionStartRef.current)
        : 0;

    answersRef.current.push({
      question_index: idx,
      a: q.a,
      b: q.b,
      table_number: q.table_number,
      correct_answer: q.expected,
      given_answer: given,
      is_correct: isCorrect,
      response_time_ms: responseMs,
    });

    if (isCorrect) setCorrectCount((c) => c + 1);

    const nextIdx = idx + 1;
    setAnswer("");

    if (nextIdx >= questions.length) {
      setFinished(true);
      submitResult();
      return;
    }

    setIdx(nextIdx);
    questionStartRef.current = performance.now();
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      onNext(false);
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  if (error && !finished) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Maths Test</h1>
        <div style={{ background: "#ffe6e6", padding: 12, borderRadius: 10 }}>
          {error}
        </div>
        <p style={{ marginTop: 16 }}>
          <Link href="/student/tests">Back</Link>
        </p>
      </div>
    );
  }

  if (finished) {
    return (
      <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ fontSize: 48 }}>Finished!</h1>
        <p style={{ fontSize: 20 }}>
          Score: <b>{correctCount}</b> / {questions.length}
        </p>
        <p style={{ opacity: 0.75 }}>
          Saved for teachers (attempts + question records).
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/student/tests">Back</Link>
        </p>
      </div>
    );
  }

  const q = questions[idx];

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 44, marginBottom: 10 }}>Maths Test</h1>

      <p style={{ marginTop: 0 }}>
        Class: <b>{settings?.class_label || "?"}</b>
        <br />
        Tables: <b>{minT}</b> to <b>{maxT}</b>
        <br />
        Questions: <b>{questionCount}</b> • Time: <b>{secondsPerQuestion}s</b>
      </p>

      <div style={{ marginTop: 12, fontSize: 18 }}>
        Time left:{" "}
        <b style={{ fontSize: 22 }}>{timeLeft}s</b>{" "}
        {pauseBetween && <span style={{ marginLeft: 10 }}>…next question…</span>}
      </div>

      <p style={{ marginTop: 18 }}>
        Question <b>{idx + 1}</b> of {questions.length}
      </p>

      <div style={{ fontSize: 36, marginTop: 10 }}>
        {q.a} × {q.b} = ?
      </div>

      <div style={{ marginTop: 18 }}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={onKeyDown}
          inputMode="numeric"
          autoFocus
          style={{
            fontSize: 24,
            padding: "12px 14px",
            width: 240,
            borderRadius: 12,
            border: "1px solid #ccc",
          }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          onClick={() => onNext(false)}
          disabled={pauseBetween}
          style={{
            fontSize: 18,
            padding: "12px 22px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            opacity: pauseBetween ? 0.5 : 1,
          }}
        >
          Next (or press Enter)
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/student/tests">Exit</Link>
      </div>
    </div>
  );
}
