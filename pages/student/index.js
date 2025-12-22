import { useEffect, useMemo, useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingClasses(true);
      setError("");

      try {
        const res = await fetch("/api/public/classes");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "Could not load classes");
          setLoadingClasses(false);
          return;
        }

        setClasses(data.classes || []);

        // Auto-select first class if none chosen (optional)
        if (!classLabel && (data.classes || []).length > 0) {
          setClassLabel(data.classes[0].class_label);
        }

        setLoadingClasses(false);
      } catch (e) {
        setError("Could not load classes (network error)");
        setLoadingClasses(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classOptions = useMemo(() => {
    return (classes || []).map((c) => ({
      value: c.class_label,
      label: `${c.class_label} (Year ${c.year_group})`,
    }));
  }, [classes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const cleanName = String(name || "").trim();
    const cleanClass = String(classLabel || "").trim().toUpperCase();

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }

    if (!cleanClass) {
      setError("Please choose your class.");
      return;
    }

    // Send them to the test start screen with name & class in the URL
    const encodedName = encodeURIComponent(cleanName);
    const encodedClass = encodeURIComponent(cleanClass);

    window.location.href = `/student/tests?name=${encodedName}&class=${encodedClass}`;
  };

  return (
    <div style={page}>
      <div style={card}>
        {/* Header */}
        <div style={headerRow}>
          <div style={logoCircle}>
            <span style={logoText}>BM</span>
          </div>
          <div>
            <div style={smallTitle}>Student Login</div>
            <div style={bigTitle}>Times Tables Test</div>
          </div>
        </div>

        <p style={subText}>
          Enter your <strong>name</strong> and choose your <strong>class</strong>.
          Your results will be saved so your teacher can see your progress.
        </p>

        {error && <div style={errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: "1.25rem" }}>
          {/* Name */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={label}>Name</label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder="e.g. Jamie"
              autoComplete="off"
            />
          </div>

          {/* Class dropdown */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={label}>Class</label>

            {loadingClasses ? (
              <div style={loadingBox}>Loading classes…</div>
            ) : (
              <select
                value={classLabel}
                onChange={(e) => setClassLabel(e.target.value)}
                style={select}
                required
              >
                {classOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button type="submit" style={button} disabled={loadingClasses}>
            Start Test
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <a href="/" style={backLink}>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles (same branding vibe) ---------- */

const page = {
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
};

const card = {
  background: "rgba(3,7,18,0.95)",
  borderRadius: "22px",
  padding: "2rem 2.5rem",
  maxWidth: "520px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  gap: "0.8rem",
  marginBottom: "1.25rem",
};

const logoCircle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "white",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logoText = {
  fontWeight: 900,
  fontSize: "1.1rem",
  color: "#0f172a",
};

const smallTitle = {
  fontSize: "0.75rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const bigTitle = {
  fontSize: "1.3rem",
  fontWeight: 800,
  color: "#facc15",
};

const subText = {
  color: "#d1d5db",
  fontSize: "0.95rem",
  marginTop: "0.25rem",
};

const label = {
  display: "block",
  marginBottom: "0.35rem",
  fontSize: "0.9rem",
  color: "#e5e7eb",
};

const input = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "1rem",
  borderRadius: "999px",
  border: "1px solid #4b5563",
  outline: "none",
};

const select = {
  width: "100%",
  padding: "10px 12px",
  fontSize: "1rem",
  borderRadius: "999px",
  border: "1px solid #4b5563",
  outline: "none",
  background: "white",
  color: "#111827",
};

const loadingBox = {
  padding: "10px 12px",
  borderRadius: "999px",
  border: "1px solid #4b5563",
  color: "#d1d5db",
  background: "#0b1220",
};

const button = {
  width: "100%",
  padding: "12px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  color: "white",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontSize: "0.95rem",
};

const backLink = {
  fontSize: "0.85rem",
  color: "#9ca3af",
  textDecoration: "underline",
};

const errorBox = {
  marginTop: "1rem",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(239,68,68,0.5)",
  background: "rgba(239,68,68,0.12)",
  color: "#fecaca",
};
