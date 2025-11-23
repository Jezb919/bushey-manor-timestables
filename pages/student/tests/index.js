// pages/student/tests/index.js

import { useRouter } from "next/router";

export default function StartTest() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const start = () => {
    router.push(`/student/tests?start=1&name=${name}&class=${className}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        padding: "1.5rem",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(3, 7, 18, 0.9)",
          padding: "2.5rem 3rem",
          borderRadius: "20px",
          maxWidth: "600px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          border: "1px solid rgba(148,163,184,0.3)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto",
            borderRadius: "999px",
            background: "#f9fafb",
            border: "2px solid #facc15",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <img
            src="/bushey-logo.png"
            alt="Bushey Manor"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "#facc15",
            marginBottom: "0.5rem",
          }}
        >
          Welcome {name}
        </h1>

        <p style={{ fontSize: "1.1rem", color: "#e5e7eb", marginBottom: "1rem" }}>
          Class: {className}
        </p>

        <p style={{ fontSize: "1.1rem", color: "#cbd5e1" }}>
          You are about to begin your <strong>Mixed Times Tables Test</strong>.
        </p>

        <p style={{ fontSize: "1.1rem", color: "#cbd5e1", marginTop: "0.25rem" }}>
          You will have <strong>6 seconds to get ready</strong> and then each
          question will automatically move on after a short delay.
        </p>

        <button
          onClick={start}
          style={{
            marginTop: "2rem",
            padding: "14px 32px",
            fontSize: "1.2rem",
            fontWeight: 700,
            borderRadius: "999px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg,#f59e0b,#facc15)",
            color: "#111827",
            boxShadow: "0 0 18px rgba(250,204,21,0.5)",
          }}
        >
          Start Test
        </button>
      </div>
    </div>
  );
}
