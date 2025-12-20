import { useEffect, useMemo, useState } from "react";

/**
 * IMPORTANT:
 * Your teacher page might have saved settings under a slightly different key name.
 * So we check several likely keys.
 */
const POSSIBLE_SETTINGS_KEYS = [
  "bmtt_teacher_settings_v2",
  "bmtt_teacher_settings",
  "bmtt_settings_v2",
  "bmtt_settings",
];

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normaliseSettings(parsed) {
  if (!parsed || typeof parsed !== "object") return null;

  const questionCount = clampNumber(parsed.questionCount, 10, 60, null);
  const secondsPerQuestion = clampNumber(parsed.secondsPerQuestion, 3, 6, null);

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
}

function readTeacherSettingsFromLocalStorage() {
  try {
    for (const key of POSSIBLE_SETTINGS_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // Sometimes people accidentally save plain text; protect against that
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      const s = normaliseSettings(parsed);
      if (s && (s.questionCount || s.secondsPerQuestion || s.tablesIncluded)) {
        return { keyUsed: key, settings: s };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [classLabel, setClassLabel] = useState("M4");

  // what we detected from teacher settings
  const [detectedKey, setDetectedKey] = useState(null);
  const [detectedSettings, setDetectedSettings] = useState(null);

  // Load settings once on page load
  useEffect(() => {
    if (typeof window === "undefined") return;

    const found = readTeacherSettingsFromLocalStorage();
    if (found) {
      setDetectedKey(found.keyUsed);
      setDetectedSettings(found.settings);
    } else {
      setDetectedKey(null);
      setDetectedSettings(null);
    }
  }, []);

  const settingsSummary = useMemo(() => {
    if (!detectedSettings) return "None found (using defaults).";
    const qc = detectedSettings.questionCount ?? "(default)";
    const sec = detectedSettings.secondsPerQuestion ?? "(default)";
    const tables = detectedSettings.tablesIncluded?.join(", ") ?? "(default)";
    return `Questions: ${qc} | Seconds: ${sec} | Tables: ${tables}`;
  }, [detectedSettings]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanName = String(name || "").trim();
    const cleanClass = String(classLabel || "").trim().toUpperCase();

    if (!cleanName || !cleanClass) return;

    // Build URL WITHOUT pre-encoding (URLSearchParams handles encoding safely)
    const qs = new URLSearchParams();
    qs.set("name", cleanName);
    qs.set("class", cleanClass);

    // If teacher settings were detected, pass them into the test as URL params
    // so they 100% apply when the test opens.
    const qc = detectedSettings?.questionCount;
    const sec = detectedSettings?.secondsPerQuestion;
    const tables = detectedSettings?.tablesIncluded;

    if (qc) qs.set("qc", String(qc));
    if (sec) qs.set("sec", String(sec));
    if (tables?.length) qs.set("tables", tables.join(","));

    // Go straight to the real test page
    window.location.href = `/student/tests/mixed?${qs.toString()}`;
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>BM</div>
          <div>
            <div style={kickerStyle}>Student Login</div>
            <div style={titleStyle}>Times Tables Test</div>
          </div>
        </div>

        <p style={{ color: "#d1d5db", marginTop: 6 }}>
          Enter your <strong>name</strong> and pick your <strong>class</strong>.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Jez Boggie"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Class</label>
            <select
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              style={inputStyle}
            >
              <option value="M3">M3</option>
              <option value="B3">B3</option>
              <option value="M4">M4</option>
              <option value="B4">B4</option>
              <option value="M5">M5</option>
              <option value="B5">B5</option>
              <option value="M6">M6</option>
              <option value="B6">B6</option>
            </select>
          </div>

          <button type="submit" style={buttonStyle}>
            Start Test
          </button>
        </form>

        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.25)" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 900 }}>
            Loaded settings (debug)
          </div>
          <div style={{ marginTop: 6, color: "#e5e7eb", fontSize: 13 }}>
            {settingsSummary}
          </div>
          <div style={{ marginTop: 6, color: "#9ca3af", fontSize: 12 }}>
            Key used: {detectedKey ?? "none"}
          </div>
        </div>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <a href="/" style={{ fontSize: 13, color: "#9ca3af", textDecoration: "underline" }}>
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

/* Styles */
const pageStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "white",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  background: "rgba(3,7,18,0.95)",
  borderRadius: "22px",
  padding: "2rem 2.5rem",
  maxWidth: "560px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const logoStyle = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "white",
  border: "3px solid #facc15",
  display: "grid",
  placeItems: "center",
  fontWeight: 1000,
  color: "#0f172a",
};

const kickerStyle = {
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
  fontWeight: 900,
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 1000,
  color: "#facc15",
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  color: "#e5e7eb",
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 16,
  borderRadius: 999,
  border: "1px solid #4b5563",
  outline: "none",
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  color: "white",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontSize: 14,
};
