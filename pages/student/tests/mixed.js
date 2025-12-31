import { useEffect, useMemo, useState } from "react";
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

  const minT = useMemo(() => Number(settings?.minimum_table ?? 2), [settings]);
  const maxT = useMemo(() => Number(settings?.maximum_table ?? 12), [settings]);

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

        // Build a 25-question mixed test
        const qs = Array.from({ length: 25 }).map(() => {
          const a = randInt(minT, maxT);
          const b = randInt(2, 12);
          return { a, b, expected: a * b };
        });

        if (mounted) {
          setSession(sJson.session);
          setSettings(setJson.settings);
          setQuestions(qs);
          setIdx(0);
          setAnswer("");
          setCorrectCount(0);
          setFinished(false);
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
  }, [router]); // run once

  async function submitResult(finalCorrect) {
    try {
      // Send to your existing submit endpoint.
      // It can ignore unknown fields if it wants.
      await fetch("/api/tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: session?.studentId,
          class_id: session?.class_id,
          test_type: "mixed",
          total: questions.length,
          score: finalCorrect,
          questions: questions.map((q) => ({ a: q.a, b: q.b, expected: q.expected })),
        }),
      });
    } catch {
      // Even if saving fails, we still show the score on screen.
    }
  }

  function onNext() {
    const q = questions[idx];
    const given = Number(answer);
    const isCorrect = !Number.isNaN(given) && given === q.expected;

    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(newCorrect);

    const nextIdx = idx + 1;
    setAnswer("");

    if (nextIdx >= questions.length) {
      setFinished(true);
      submitResult(newCorrect);
      return;
    }

    setIdx(nextIdx);
  }

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Times Tables Arena</h1>
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
