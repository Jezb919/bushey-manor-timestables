import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";

const TOTAL_QUESTIONS = 3;     // keep 3 for now while we debug saving
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
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(6); // per-question timer

  const [answers, setAnswers] = useState([]); // store all answers for Supabase

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

  // Per-question 6-second timer with auto-advance
  useEffect(() => {
    if (!showQuestion) return;
    if (waiting) return;
    if (!current) return;

    // Reset timer at start of each question
    setQuestionSecondsLeft(6);

    const interval = setInterval(() => {
      setQuestionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Time is up – auto submit (does NOT count as correct)
          submitAnswer(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, showQuestion, waiting, current]);

  // ENTER key submits answer (manual submission)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !waiting && showQuestion) {
      submitAnswer(false);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Helper: create or find student in Supabase
  const getOrCreateStudent = async (studentName, studentClass) => {
    if (!studentName || !studentClass) return null;

    // Try to derive year group from class name like "4M"
    const match = String(studentClass).match(/^\d+/);
    const yearGroup = match ? parseInt(match[0], 10) : 0;

    // Look for existing student
    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("*")
      .eq("name", studentName)
      .eq("class", studentClass)
      .eq("year_group", yearGroup)
      .limit(1);

    if (existingError) {
      console.error("Error checking student:", existingError);
    }

    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    // Insert new student
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert([
        {
          name: studentName,
          class: studentClass,
          year_group: yearGroup,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting student:", insertError);
      return null;
    }

    return inserted.id;
  };

  // Save test + questions to Supabase then go to result screen
  const saveTestAndRedirect = async (finalScore, finalAnswers) => {
    try {
      const decodedName =
        typeof name === "string" ? decodeURIComponent(name) : "";
      const decodedClass =
        typeof className === "string" ? decodeURIComponent(className) : "";

      const studentId = await getOrCreateStudent(decodedName, decodedClass);

      if (!studentId) {
        alert("Could not create or find student – test will not be saved.");
      }

      const tablesUsed = Array.from(new Set(questions.map((q) => q.b)));

      // Insert test summary
      const { data: testRow, error: testError } = await supabase
        .from("tests")
        .insert([
          {
            student_id: studentId,
            score: finalScore,
            total: questions.length,
            percentage: (finalScore / questions.length) * 100,
            tables_used: tablesUsed,
            question_time: 6, // later this will come from teacher_settings
          },
        ])
        .select()
        .single();

      if (testError) {
        alert("Error saving test: " + testError.message);
        console.error("Error inserting test:", testError);
      }

      if (!testError && testRow && finalAnswers && finalAnswers.length > 0) {
        const questionRows = finalAnswers.map((q) => ({
          test_id: testRow.id,
          a: q.a,
          b: q.b,
          correct_answer: q.correct_answer,
          student_answer: q.student_answer,
          was_correct: q.was_correct,
        }));

        const { error: questionsError } = await supabase
          .from("test_questions")
          .insert(questionRows);

        if (questionsError) {
          alert("Error saving questions: " + questionsError.message);
          console.error("Error inserting test questions:", questionsError);
        }
      }
    } catch (err) {
      alert("Unexpected error saving test: " + err.message);
      console.error("Unexpected error saving test:", err);
    }

    // Always go to result screen, even if saving fails
    router.push(
      `/student/tests/result?score=${finalScore}&total=${questions.length}&name=${encodeURIComponent(
        name || ""
      )}&class=${encodeURIComponent(className || "")}`
    );
  };

  // auto = true when timer runs out
  const submitAnswer = (auto = false) => {
    if (waiting || !current) return;

    const parsedAnswer =
      answer === "" || answer === null ? null : parseInt(answer, 10);

    const isCorrect = !auto && parsedAnswer === current.correct;
    const newScore = isCorrect ? score + 1 : score;

    // Collect this question result for Supabase
    const questionResult = {
      a: current.a,
      b: current.b,
      correct_answer: current.correct,
      student_answer: auto ? null : parsedAnswer,
      was_correct: isCorrect,
    };

    if (isCorrect) setScore(newScore);

    setAnswer("");
    setWaiting(true);

    // 2-second gap before next question
    setTimeout(() => {
      setWaiting(false);

      if (questionIndex + 1 < questions.length) {
        // Not finished yet → just store this question and move on
        setAnswers((prev) => [...prev, questionResult]);
        setQuestionIndex((prev) => prev + 1);
      } else {
        // Last question → include this one and save full test
        const allAnswers = [...answers, questionResult];
        saveTestAndRedirect(newScore, allAnswers);
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
          {/* Visible per-question countdown */}
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
              color: questionSecondsLeft <= 2 ? "#f97316" : "#facc15",
            }}
          >
            Time left: {questionSecondsLeft}s
          </div>

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
              onClick={() => submitAnswer(false)}
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
