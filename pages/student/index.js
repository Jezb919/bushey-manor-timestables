import { useRouter } from "next/router";

export default function StartTest() {
  const router = useRouter();
  const { name, class: className } = router.query;

  const startTest = () => {
    router.push(`/student/tests/mixed?name=${name}&class=${className}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(3,7,18,0.95)",
          borderRadius: "20px",
          padding: "2.25rem",
          maxWidth: "650px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          border: "1px solid rgba(148,163,184,0.3)",
        }}
      >
        {/* Logo + Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "999px",
              background: "#f9fafb",
              overflow: "hidden",
              border: "3px solid #facc15",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
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
              fontSize: "2rem",
              fontWeight: 800,
              color: "#facc15",
              marginBottom: "0.5rem",
            }}
          >
            Maths Test
          </h1>

          <p
            style={{
              color: "#e5e7eb",
              fontSize: "1rem",
              marginBottom: "1rem",
            }}
          >
            Mixed Times Tables Challenge
          </p>
        </div>

        {/* Student details */}
        {name && className && (
          <p
            style={{
              marginBottom: "1.2rem",
              color: "#9ca3af",
              fontSize: "1rem",
            }}
          >
            <strong>{name}</strong> from <strong>{className}</strong>
          </p>
        )}

        {/* Start Button */}
        <button
          onClick={startTest}
          style={{
            padding: "14px 32px",
            background: "linear-gradient(135deg,#f59e0b,#facc15)",
            color: "#111827",
            borderRadius: "999px",
            fontWeight: 700,
            fontSize: "1.1rem",
            border: "none",
            letterSpacing: "0.08em",
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(250,204,21,0.4)",
          }}
        >
          Start Test
        </button>
      </div>
    </div>
  );
}
