// pages/student/index.js
import { useEffect, useMemo, useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [classLabel, setClassLabel] = useState("");

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/classes");
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j?.details || j?.error || "Failed to load classes");

        setClasses(Array.isArray(j.classes) ? j.classes : []);

        // default to first class in list (if exists)
        const first = (j.classes || []).find((c) => c.class_label)?.class_label;
        if (first && !classLabel) setClassLabel(first);
      } catch (e) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    // group by year_group for nicer dropdown sections
    const map = new Map();
    for (const c of classes) {
      const y = c.year_group || 0;
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [classes]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanClass = String(classLabel || "").trim();

    if (!cleanName || !cleanClass) return;

    const encodedName = encodeURIComponent(cleanName);
    const encodedClass = encodeURIComponent(cleanClass);

    window.location.href = `/student/tests?name=${encodedName}&class=${encodedClass}`;
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.headerRow}>
          <div style={S.logo}>BM</div>
          <div>
            <div style={S.kicker}>Student Login</div>
            <div style={S.title}>Times Tables Test</div>
          </div>
        </div>

        <p style={S.muted}>
          Enter your <strong>name</strong> and choose your <strong>class</strong>.
        </p>

        {err && <div style={S.errorBox}><strong>Error:</strong> {err}</div>}

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <label style={S.label}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={S.input}
            placeholder="e.g. Alex"
          />

          <div style={{ height: 12 }} />

          <label style={S.label}>Class</label>

          {loading ? (
            <div style={S.muted}>Loading classes…</div>
          ) : (
            <select
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              required
              style={S.select}
            >
              {grouped.map(([year, list]) => (
                <optgroup key={year} label={year ? `Year ${year}` : "Other"}>
                  {list.map((c) => (
                    <option key={c.class_label} value={c.class_label}>
                      {c.class_label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          <button type="submit" style={S.primaryBtn} disabled={loading || !!err}>
            Start Test
          </button>
        </form>

        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a href="/" style={S.link}>Back to Home</a>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#F7F7FB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#111827",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    border: "1px solid #E5E7EB",
    background: "white",
    boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
    padding: 18,
  },
  headerRow: { display: "flex", gap: 12, alignItems: "center" },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 999,
    background: "#FACC15",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    border: "1px solid #E5E7EB",
  },
  kicker: {
    fontSize: "0.78rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#6B7280",
    fontWeight: 900,
  },
  title: { fontSize: "1.35rem", fontWeight: 1000, marginTop: 2 },
  muted: { color: "#6B7280", marginTop: 10 },

  label: { display: "block", marginTop: 14, fontWeight: 900, color: "#374151" },
  input: {
    width: "100%",
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    outline: "none",
  },
  select: {
    width: "100%",
    marginTop: 6,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "white",
    outline: "none",
    cursor: "pointer",
  },
  primaryBtn: {
    width: "100%",
    marginTop: 16,
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg,#2563EB,#60A5FA)",
  },
  link: { color: "#2563EB", textDecoration: "underline", fontWeight: 800 },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#991B1B",
    fontWeight: 800,
  },
};
