import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function StudentTestStart() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");

  // When the query is ready, store a nice version of name/class
  useEffect(() => {
    if (!router.isReady) return;

    if (typeof name === "string") {
      setStudentName(decodeURIComponent(name));
    }
    if (typeof className === "string") {
      setStudentClass(decodeURIComponent(className));
    }
  }, [router.isReady, name, className]);

  const handleStart = () => {
    // Go to the dynamic [table] route – we use "mixed" as the slug
    router.push(
      `/student/tests/mixed?name=${encodeURIComponent(
        studentName
      )}&class=${encodeURIComponent(studentClass)}`
    );
  };

  // Simple loading state while query params are being read
  if (!router.isReady) {
    return (
      <div style={outerStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: "1.2rem" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {/* Header / branding */}
        <Header />

        <div style={{ marginTop: "1.75rem" }}>
          <h1
            style={{
              fontSize: "2.1rem",
              fontWeight: 800,
              color: "#facc15",
              marginBottom: "0.5rem",
            }}
          >
            Maths Test
          </h1>

          <p style={{ color: "#e5e7eb", marginBottom: "0.5rem" }}>
            This test includes <strong>mixed times tables</strong>.
          </p>

          {studentName && (
            <p style={{ color: "#9ca3af", marginTop: "0.25rem" }}>
              Pupil: <strong>{studentName}</strong>
              {studentClass && (
                <>
                  {" "}
                  – Class <strong>{studentClass}</strong>
                </>
              )}
            </p>
          )}

          <ul
            style={{
              marginTop: "1rem",
              color: "#d1d5db",
              fontSize: "0.95rem",
              paddingLeft: "1.2rem",
            }}
          >
            <li>There are 25 questions.</li>
            <li>You will see one question at a time.</li>
            <li>You can press <strong>Enter</strong> instead of clicking.</li>
          </ul>

          <button
            type="button"
            onClick={handleStart}
            style={{
              marginTop: "1.75rem",
              padding: "14px 34px",
              fontSize: "1.1rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
              color: "white",
              boxShadow: "0 12px 30px rgba(37,99,235,0.6)",
            }}
          >
            Start Test
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared layout styles (match the test page) ---------- */

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
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/* ---------- Simple Header (same style family as test page) ---------- */

function Header() {
  return (
    <div>
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
            {/* Placeholder logo initials */}
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
      </div>
    </div>
  );
}
