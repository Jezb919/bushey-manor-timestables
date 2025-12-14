import { useEffect, useMemo, useState } from "react";

export default function TeacherDashboard() {
  const [classLabel, setClassLabel] = useState("M4"); // default
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTop10, setShowTop10] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/teacher/overview?class_label=${encodeURIComponent(
          classLabel
        )}&days=${encodeURIComponent(days)}`
      );
      const json = await res.json();
      setData(json);
    } catch (e) {
      setData({ ok: false, error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLabel, days]);

  const leaderboard = useMemo(() => {
    const list = data?.leaderboard || [];

    // remove totally empty rows (no attempts)
    const cleaned = list.filter((r) => r.student);

    // search filter
    const searched = cleaned.filter((r) =>
      String(r.student || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

    // only include people with a score for ranking
    const withScores = searched.filter((r) => typeof r.percent === "number");

    // Sort by percent desc, then latest date desc
    const sorted = [...searched].sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      if (bp !== ap) return bp - ap;
      const ad = a.latest_at ? new Date(a.latest_at).getTime() : 0;
      const bd = b.latest_at ? new Date(b.latest_at).getTime() : 0;
      return bd - ad;
    });

    if (!showTop10) return sorted;

    // Top 10% (rounded up, minimum 1)
    const n = Math.max(1, Math.ceil(withScores.length * 0.1));
    const topIds = new Set(
      withScores
        .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1))
        .slice(0, n)
        .map((x) => x.student_id)
    );

    return sorted.filter((x) => topIds.has(x.student_id));
  }, [data, search, showTop10]);

  const mostImproved = useMemo(() => {
    const list = (data?.leaderboard || []).filter(
      (r) => typeof r.delta_percent === "number"
    );
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => (b.delta_percent ?? 0) - (a.delta_percent ?? 0));
    return sorted.slice(0, 5);
  }, [data]);

  if (data && data.ok === false) {
    return (
      <div style={pageStyle}>
        <Card>
          <h1 style={h1}>Teacher Dashboard</h1>
          <p style={muted}>Could not load data.</p>
          <pre style={preStyle}>{JSON.stringify(data, null, 2)}</pre>
        </Card>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Card>
        <Header />

        <div style={{ marginTop: 18 }}>
          <div style={controlsRow}>
            <div style={{ flex: 1 }}>
              <label style={label}>Class</label>
              <select
                value={classLabel}
                onChange={(e) => setClassLabel(e.target.value)}
                style={input}
              >
                {/* Your preferred format: M4, B4, M3, B3, M5, B5, M6, B6 */}
                {["M3","B3","M4","B4","M5","B5","M6","B6"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ width: 170 }}>
              <label style={label}>Days (trend)</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={input}
              >
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={30}>30</option>
                <option value={90}>90</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={label}>Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a name…"
                style={input}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <button
                onClick={() => setShowTop10((p) => !p)}
                style={button(showTop10 ? "gold" : "dark")}
              >
                {showTop10 ? "Showing Top 10%" : "Top 10%"}
              </button>

              <button onClick={load} style={button("blue")}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div style={twoCol}>
            <div>
              <h2 style={h2}>Class leaderboard</h2>
              <p style={muted}>
                Colour bands: <strong>full marks</strong>, 20–24, 15–19, 10–14, below 10.
              </p>

              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Student</th>
                      <th style={th}>Latest</th>
                      <th style={th}>Score</th>
                      <th style={th}>%</th>
                      <th style={th}>Δ%</th>
                      <th style={th}>Attempts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r) => {
                      const pct = typeof r.percent === "number" ? r.percent : null;
                      const band = bandForPercent(pct, r.total);
                      return (
                        <tr key={r.student_id} style={{ background: band.bg }}>
                          <td style={td}>
                            <div style={{ fontWeight: 700 }}>{r.student || "—"}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>
                              {r.class_label || classLabel}
                            </div>
                          </td>
                          <td style={td}>
                            {r.latest_at
                              ? new Date(r.latest_at).toLocaleString()
                              : "—"}
                          </td>
                          <td style={td}>
                            {typeof r.score === "number" && typeof r.total === "number"
                              ? `${r.score}/${r.total}`
                              : "—"}
                          </td>
                          <td style={td}>
                            {pct === null ? "—" : (
                              <span style={pill(band.pill)}>{pct}%</span>
                            )}
                          </td>
                          <td style={td}>
                            {typeof r.delta_percent === "number"
                              ? `${r.delta_percent > 0 ? "+" : ""}${r.delta_percent}%`
                              : "—"}
                          </td>
                          <td style={td}>{r.attempts_in_range ?? 0}</td>
                        </tr>
                      );
                    })}
                    {!leaderboard.length && (
                      <tr>
                        <td style={td} colSpan={6}>
                          No results yet for this class.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16 }}>
                <h2 style={h2}>Most improved (top 5)</h2>
                {!mostImproved ? (
                  <p style={muted}>
                    Not enough history yet to calculate improvement. Run a few more tests first.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {mostImproved.map((r) => (
                      <li key={r.student_id} style={{ marginBottom: 6 }}>
                        <strong>{r.student}</strong> —{" "}
                        <span style={{ color: "#22c55e", fontWeight: 800 }}>
                          +{r.delta_percent}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <h2 style={h2}>Class trend</h2>
              <p style={muted}>Average % per day (last {days} days).</p>
              <TrendChart trend={data?.classTrend || []} />

              <div style={{ marginTop: 18 }}>
                <h2 style={h2}>Times table heatmap (1–19)</h2>
                <p style={muted}>Shows strongest/weakest tables based on answered questions.</p>
                <HeatMap items={data?.tableHeat || []} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <details>
              <summary style={{ cursor: "pointer", color: "#93c5fd" }}>
                Debug: view raw JSON
              </summary>
              <pre style={preStyle}>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- UI bits ---------------- */

function Header() {
  return (
    <div style={topRow}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={logoCircle}>
          <span style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>BM</span>
        </div>
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#e5e7eb" }}>
            Teacher dashboard
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#facc15" }}>
            Times Tables Arena
          </div>
        </div>
      </div>

      <a href="/" style={{ color: "#93c5fd", textDecoration: "underline" }}>
        Home
      </a>
    </div>
  );
}

function Card({ children }) {
  return <div style={cardStyle}>{children}</div>;
}

function TrendChart({ trend }) {
  // trend: [{day:"YYYY-MM-DD", avg_percent:number, attempts:number}]
  if (!trend.length) {
    return <div style={miniCard}><p style={muted}>No trend data yet.</p></div>;
  }

  const max = Math.max(...trend.map((t) => t.avg_percent ?? 0), 1);

  return (
    <div style={miniCard}>
      {trend.map((t) => {
        const w = Math.round(((t.avg_percent ?? 0) / max) * 100);
        return (
          <div key={t.day} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <div style={{ width: 92, fontSize: 12, color: "#cbd5e1" }}>
              {t.day}
            </div>
            <div style={{ flex: 1, background: "#0b1220", borderRadius: 999, overflow: "hidden", height: 10 }}>
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  background: "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
                }}
              />
            </div>
            <div style={{ width: 60, textAlign: "right", fontSize: 12, color: "#e2e8f0" }}>
              {Math.round(t.avg_percent ?? 0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeatMap({ items }) {
  // items: [{table_num, total, correct, accuracy}]
  if (!items.length) {
    return <div style={miniCard}><p style={muted}>No heatmap data yet.</p></div>;
  }

  return (
    <div style={miniCard}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
        {items.map((t) => {
          const acc = typeof t.accuracy === "number" ? t.accuracy : null;
          const bg = heatColour(acc);
          return (
            <div key={t.table_num} style={{ padding: 12, borderRadius: 14, background: bg, border: "1px solid rgba(148,163,184,0.25)" }}>
              <div style={{ fontSize: 12, color: "#e2e8f0", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Table
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>{t.table_num}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#e2e8f0" }}>
                {t.correct ?? 0}/{t.total ?? 0} correct
              </div>
              <div style={{ marginTop: 2, fontSize: 12, color: "#e2e8f0" }}>
                Accuracy: {acc === null ? "—" : `${Math.round(acc)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function bandForPercent(percent, total) {
  // Colour bands you requested. Using clear but friendly colours.
  // Full marks = percent 100 (or score==total when total is small).
  const full = typeof percent === "number" && percent >= 100;

  if (full) return { bg: "rgba(34,197,94,0.18)", pill: "green" };       // Green
  if (typeof percent !== "number") return { bg: "transparent", pill: "grey" };

  if (percent >= 80) return { bg: "rgba(250,204,21,0.16)", pill: "gold" };  // Gold
  if (percent >= 60) return { bg: "rgba(59,130,246,0.14)", pill: "blue" };  // Blue
  if (percent >= 40) return { bg: "rgba(249,115,22,0.14)", pill: "orange" };// Orange
  return { bg: "rgba(239,68,68,0.14)", pill: "red" };                       // Red
}

function pill(kind) {
  const map = {
    green: "rgba(34,197,94,0.25)",
    gold: "rgba(250,204,21,0.25)",
    blue: "rgba(59,130,246,0.25)",
    orange: "rgba(249,115,22,0.25)",
    red: "rgba(239,68,68,0.25)",
    grey: "rgba(148,163,184,0.18)",
  };

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 800,
    background: map[kind] || map.grey,
    border: "1px solid rgba(148,163,184,0.25)",
  };
}

function heatColour(acc) {
  // Map accuracy → background colour
  if (acc === null || typeof acc !== "number") return "rgba(148,163,184,0.10)";
  if (acc >= 90) return "rgba(34,197,94,0.20)";
  if (acc >= 75) return "rgba(250,204,21,0.20)";
  if (acc >= 50) return "rgba(249,115,22,0.20)";
  return "rgba(239,68,68,0.20)";
}

/* ---------------- styles ---------------- */

const pageStyle = {
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

const cardStyle = {
  background: "rgba(3,7,18,0.92)",
  borderRadius: 22,
  padding: "1.75rem 2rem",
  maxWidth: 1100,
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const miniCard = {
  background: "rgba(2,6,23,0.75)",
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.25)",
  padding: 14,
};

const topRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const logoCircle = {
  width: 56,
  height: 56,
  borderRadius: 999,
  background: "#f8fafc",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const controlsRow = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
};

const twoCol = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 18,
  marginTop: 18,
};

const h1 = { margin: 0, fontSize: 28, fontWeight: 900 };
const h2 = { margin: "14px 0 8px", fontSize: 18, fontWeight: 900, color: "#facc15" };
const muted = { margin: "6px 0", color: "#cbd5e1", fontSize: 13 };

const label = { display: "block", marginBottom: 6, color: "#e2e8f0", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" };

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.35)",
  outline: "none",
  background: "rgba(2,6,23,0.9)",
  color: "white",
};

const tableWrap = {
  overflowX: "auto",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.25)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 720,
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#cbd5e1",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(2,6,23,0.85)",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
  fontSize: 13,
};

const preStyle = {
  background: "rgba(2,6,23,0.85)",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.25)",
  padding: 12,
  overflowX: "auto",
  marginTop: 10,
  fontSize: 12,
  color: "#e2e8f0",
};

function button(kind) {
  const styles = {
    blue: {
      background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
      color: "white",
    },
    dark: {
      background: "rgba(148,163,184,0.15)",
      color: "white",
    },
    gold: {
      background: "linear-gradient(135deg,#f59e0b,#facc15)",
      color: "#0f172a",
    },
  };

  return {
    padding: "10px 14px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    fontSize: 12,
    ...styles[kind],
  };
}
