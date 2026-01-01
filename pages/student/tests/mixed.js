import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function MixedTest() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  // Timing + recording
  const startedAtRef = useRef(null);
  const questionStartRef = useRef(null);
  const [answersLog, setAnswersLog] = useState([]); // per-question answers for saving

  const minT = useMemo(() => Number(settings?.minimum_table ?? 1), [settings]);
  const maxT = useMemo(() => Number(settings?.maximum_table ?? 12), [settings]);

  const questionCount = useMemo(() => {
    const n = Number(settings?.question_count ?? settings?.num_questions ?? 25);
    return Number.isFinite(n) && n > 0 ? n : 25;
  }, [settings]);

  const secondsPerQuestion = useMemo(() => {
    const s = Number(settings?.seconds_per_question ?? 6);
    return Number.isFinite(s) && s > 0 ? s : 6;
  }, [settings]);

  const testStartDate = useMemo(() => settings?.test_start_date ?? null, [settings]);

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

        // If there is a test start date in the future, block starting.
        if (setJson.settings.test_start_date) {
          const start = new Date(setJson.settings.test_start_date);
          if (!isNaN(start.getTime()) && start.getTime() > Date.now()) {
            if (mounted) {
              setSession(sJson.session);
              setSettings(setJson.settings);
              setQuestions([]);
              setLoading(false);
              setError("Test not available yet (check class settings or start date).");
            }
            return;
          }
        }

        // Build the test based on class settings
        const qs = Array.from({ length: questionCount }).map(() => {
          const a = randInt(minT, maxT);     // table number range set by teacher/admin
          const b = randInt(2, 12);          // multiplier 2..12 (typical KS2)
          return { a, b, expected: a * b, table_number: a };
        });

        if (mounted) {
          setSession(sJson.session);
          setSettings(setJson.settings);
          setQuestions(qs);
          setIdx(0);
          setAnswer("");
          setCorrectCount(0);
          setFinished(false);
          setAnswersLog([]);
          startedAtRef.current = new Date();
          questionStartRef.current = performance.now();
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError("Failed to load test.");
          setLoading(false);
        }
      }
    }

    boot();
    return () => (mounted = false);
  }, [router, minT, maxT, questionCount]); // if settings change, rebuild

  async function submitResult(finalCorrect, finalAnswersLog) {
    try {
      const finishedAt = new Date();

      const r = await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_type: "mixed",
          started_at: startedAtRef.current?.toISOString?.() || null,
          finished_at: finishedAt.toISOString(),
          answers: finalAnswersLog,
        }),
      });

      // If saving fails we still show score, but this helps debugging.
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.log("Submit failed", r.status, j);
      } else {
        // eslint-disable-next-line no-console
        console.log("Submit OK", j);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("Submit crashed", e);
    }
  }

  function onNext() {
    const q = questions[idx];
    const given = Number(answer);
    const isCorrect = !Number.isNaN(given) && given === q.expected;

    // time for this question
    const now = performance.now();
    const responseMs =
      questionStartRef.current != null ? Math.round(now - questionStartRef.current) : null;

    const newCorrect = correctCount + (isCorrect ? 1 : 0);

    const logRow = {
      question_index: idx,
      a: q.a,
      b: q.b,
      table_number: q.table_number,
      correct_answer: q.expected,
      given_answer: answer === "" ? null : given,
      is_correct: isCorrect,
      response_time_ms: responseMs,
    };

    const nextLog = [...answersLog, logRow];
    setAnswersLog(nextLog);
    setCorrectCount(newCorrect);

    const nextIdx = idx + 1;
    setAnswer("");

    if (nextIdx >= questions.length) {
      setFinished(true);
      submitResult(newCorrect, nextLog);
      return;
    }

    setIdx(nextIdx);
    questionStartRef.current = performance.now();
  }

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Maths Test</h1>
        <p>Loading test…</p>
      </div>
    );
  }

  if (error) {
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
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Saved for teacher dashboards (attempts + heatmap data).
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/student/tests">Back to Test Home</Link>
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
        Questions: <b>{questionCount}</b> • Target speed: <b>{secondsPerQuestion}s</b>
      </p>

      <p>
        Question <b>{idx + 1}</b> of {questions.length}
      </p>

      <div style={{ fontSize: 36, marginTop: 24 }}>
        {q.a} × {q.b} = ?
      </div>

      <div style={{ marginTop: 18 }}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          inputMode="numeric"
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
          onClick={onNext}
          style={{
            fontSize: 18,
            padding: "12px 22px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
          }}
        >
          Next
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/student/tests">Exit</Link>
      </div>
    </div>
  );
}
