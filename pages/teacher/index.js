import { useEffect, useMemo, useState } from "react";

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

export default function TeacherDashboard() {
  // Scope: class | year | school | student
  const [scope, setScope] = useState("class");
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(DEFAULT_DAYS);

  const [search, setSearch] = useState("");
  const [top10, setTop10] = useState(false);

  // Drill-down
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState(null);

  // Data
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState(null);

  // When you click a student, we show Student scope view (heatmap + trend)
  const effectiveScope = selectedStudentId ? "student" : scope;

  const titleScopeText = useMemo(() => {
    if (effectiveScope === "student") return "Student";
    if (effectiveScope === "class") return "Class";
    if (effectiveScope === "year") return "Year";
    return "School";
  }, [effectiveScope]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", effectiveScope);
    params.set("days", String(days));

    if (effectiveScope === "student" && selectedStudentId) {
      params.set("student_id", selectedStudentId);
    } else if (effectiveScope === "class") {
      params.set("class_label", classLabel);
    } else if (effectiveScope === "year") {
      params.set("year", String(year));
    }
    return `/api/teacher/overview?${params.toString()}`;
  }, [effectiveScope, days, classLabel, year, selectedStudentId]);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(queryUrl);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.details || data?.error || "Failed to load overview");
      }
      setPayload(data);
    } catch (e) {
      setErr(e.message || String(e));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryUrl]);

  // Leaderboard filtering + sorting
  const leaderboard = useMemo(() => {
    const rows = (payload?.leaderboard || []).slice();

    // Search filter
    const s = search.trim().toLowerCase();
    const filtered = s
      ? rows.filter((r) => String(r.student || "").toLowerCase().includes(s))
      : rows;

    // Sort: highest percent first, nulls last
    filtered.sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      return bp - ap;
    });

    // Top 10%
    if (top10 && filtered.length > 0) {
      const n = Math.max(1, Math.ceil(filtered.length * 0.1));
      return filtered.slice(0, n);
    }
    return filtered;
  }, [payload, search, top10]);

  // Heatmap cells
  const tableHeat = payload?.tableHeat || [];

  // Class trend bars (avg % per day)
  const trend = payload?.classTrend || [];

  // Colour banding (based on %)
  const bandForPercent = (p) => {
    if (typeof p !== "number") return { bg: "#0b1220", border: "rgba(148,163,184,0.20)", tag: "—" };
    if (p >= 100) return { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.40)", tag: "FULL" }; // green
    if (p >= 80) return { bg: "rgba(59,130,246,0.16)", border: "rgba(59,130,246,0.35)", tag: "HIGH" }; // blue
    if (p >= 60) return { bg: "rgba(250,204,21,0.14)", border: "rgba(250,204,21,0.35)", tag: "OK" }; // yellow
    if (p >= 40) return { bg: "rgba(249,115,22,0.14)", border: "rgba(249,115,22,0.35)", tag: "LOW" }; // orange
    return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", tag: "RISK" }; // red
  };

  const accuracyColour = (acc) => {
    if (acc === null || typeof acc !== "number") return "rgba(148,163,184,0.18)";
    if (acc >= 90) return "rgba(34,197,94,0.28)";
    if (acc >= 70) return "rgba(59,130,246,0.24)";
    if (acc >= 50) return "rgba(250,204,21,0.22)";
    if (acc >= 30) return "rgba(249,115,22,0.22)";
    return "rgba(239,68,68,0.22)";
  };

  const pageTitle = useMemo(() => {
    if (effectiveScope === "student" && selectedStudentName) {
      return `Teacher Dashboard — ${selectedStudentName}`;
    }
    if (effectiveScope === "class") return `Teacher Dashboard — ${classLabel}`;
    if (effectiveScope === "year") return `Teacher Dashboard — Year ${year}`;
    return `Teacher Dashboard — Whole School`;
  }, [effectiveScope, selectedStudentName, classLabel, year]);

  return (
    <div style={outerStyle}>
      <div style={shellStyle}>
        {/* Header */}
        <div style={topBar}>
          <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
            <div style={logoCircle}>
              <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "#0f172a" }}>BM</span>
            </div>

            <div>
              <div style={kicker}>TEACHER DASHBOARD</div>
              <div style={title}>Times Tables Arena</div>
              <div style={subtitle}>{pageTitle}</div>
            </div>
          </div>

          <a href="/" style={homeLink}>Home</a>
        </div>

        {/* Controls */}
        <div style={controlsRow}>
          <div style={controlBlock}>
            <label style={label}>SCOPE</label>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                // leaving student drill-down if you change scope
                setSelectedStudentId(null);
                setSelectedStudentName(null);
              }}
              style={select}
            >
              <option value="class">Class</option>
              <option value="year">Year group</option>
              <option value="school">Whole school</option>
            </select>
          </div>

          <div style={controlBlock}>
            <label style={label}>CLASS</label>
            <select
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              disabled={scope !== "class"}
              style={{ ...select, opacity: scope === "class" ? 1 : 0.5 }}
            >
              {/* You can add more later */}
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

          <div style={controlBlock}>
            <label style={label}>YEAR</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={scope !== "year"}
              style={{ ...select, opacity: scope === "year" ? 1 : 0.5 }}
            >
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
              <option value={5}>Year 5</option>
              <option value={6}>Year 6</option>
            </select>
          </div>

          <div style={controlBlock}>
            <label style={label}>DAYS (TREND)</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={select}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>

          <div style={{ ...controlBlock, flex: 1 }}>
            <label style={label}>SEARCH</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name…"
              style={input}
            />
          </div>

          <button
            onClick={() => setTop10((p) => !p)}
            style={{ ...pillButton, background: top10 ? "rgba(250,204,21,0.18)" : "rgba(148,163,184,0.12)" }}
          >
            TOP 10%
          </button>

          <button onClick={refresh} style={primaryButton}>
            REFRESH
          </button>
        </div>

        {/* Drill-down banner */}
        {selectedStudentId && (
          <div style={drillBanner}>
            <div>
              <strong>Drill-down:</strong> {selectedStudentName} ({payload?.class_label || classLabel})
              <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "0.15rem" }}>
                You are viewing this student’s trend + heatmap. Click “Exit” to go back.
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedStudentId(null);
                setSelectedStudentName(null);
              }}
              style={exitButton}
            >
              Exit student view
            </button>
          </div>
        )}

        {/* Error / Loading */}
        {err && (
          <div style={errorBox}>
            <strong>Error:</strong> {err}
          </div>
        )}

        {/* Main grid */}
        <div style={grid}>
          {/* Leaderboard */}
          <div style={card}>
            <div style={cardTitle}>Leaderboard</div>
            <div style={cardSub}>
              Colour bands: <strong>FULL</strong> (100%), <strong>HIGH</strong> (80–99), <strong>OK</strong> (60–79),
              <strong> LOW</strong> (40–59), <strong> RISK</strong> (&lt;40).
            </div>

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>STUDENT</th>
                    <th style={th}>LATEST</th>
                    <th style={th}>SCORE</th>
                    <th style={th}>%</th>
                    <th style={th}>ATTEMPTS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr><td colSpan={5} style={tdMuted}>Loading…</td></tr>
                  )}

                  {!loading && leaderboard.length === 0 && (
                    <tr><td colSpan={5} style={tdMuted}>No students found for this scope.</td></tr>
                  )}

                  {!loading &&
                    leaderboard.map((r) => {
                      const band = bandForPercent(r.percent);
                      const latest = r.latest_at ? formatDate(r.latest_at) : "—";
                      const scoreText =
                        typeof r.score === "number" && typeof r.total === "number" ? `${r.score}/${r.total}` : "—";
                      const pctText = typeof r.percent === "number" ? `${r.percent}%` : "—";

                      return (
                        <tr
                          key={r.student_id}
                          style={{
                            background: band.bg,
                            borderBottom: "1px solid rgba(148,163,184,0.12)",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            if (!r.student_id) return;
                            setSelectedStudentId(r.student_id);
                            setSelectedStudentName(r.student || "Student");
                          }}
                          title="Click to drill down to this student"
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 800, color: "#f8fafc" }}>{r.student || "—"}</div>
                            <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{r.class_label || "—"}</div>
                          </td>
                          <td style={td}>{latest}</td>
                          <td style={td}>{scoreText}</td>
                          <td style={td}>
                            <span style={{ ...badge, borderColor: band.border }}>
                              {pctText} <span style={{ opacity: 0.8, marginLeft: 8 }}>{band.tag}</span>
                            </span>
                          </td>
                          <td style={td}>{r.attempts_in_range ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "0.9rem", fontSize: "0.85rem", color: "#94a3b8" }}>
              Tip: Click a student row to see their <strong>personal heatmap + trend</strong>.
            </div>
          </div>

          {/* Trend */}
          <div style={card}>
            <div style={cardTitle}>{titleScopeText} trend</div>
            <div style={cardSub}>Average % per day (last {days} days).</div>

            {trend.length === 0 ? (
              <div style={emptyBox}>No trend data yet. Run a few tests first.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.9rem" }}>
                {trend
                  .slice()
                  .sort((a, b) => (a.day > b.day ? 1 : -1))
                  .map((t) => {
                    const pct = typeof t.avg_percent === "number" ? t.avg_percent : 0;
                    return (
                      <div key={t.day} style={trendRow}>
                        <div style={trendDay}>{t.day}</div>
                        <div style={trendBarOuter}>
                          <div style={{ ...trendBarInner, width: `${Math.max(0, Math.min(100, pct))}%` }} />
                        </div>
                        <div style={trendPct}>{typeof t.avg_percent === "number" ? `${t.avg_percent}%` : "—"}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Heatmap */}
          <div style={card}>
            <div style={cardTitle}>
              Times table heatmap (1–19)
            </div>
            <div style={cardSub}>
              Click a tile to highlight it. Click a student to drill-down to that student’s heatmap.
            </div>

            {tableHeat.length === 0 ? (
              <div style={emptyBox}>No heatmap data yet. Run a few tests first.</div>
            ) : (
              <HeatmapGrid tableHeat={tableHeat} accuracyColour={accuracyColour} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Heatmap component ---------------- */

function HeatmapGrid({ tableHeat, accuracyColour }) {
  const [activeTable, setActiveTable] = useState(null);

  return (
    <div style={heatWrap}>
      {tableHeat.map((cell) => {
        const tableNum = cell.table_num;
        const acc = cell.accuracy;
        const total = cell.total || 0;
        const correct = cell.correct || 0;

        const active = activeTable === tableNum;

        return (
          <button
            key={tableNum}
            onClick={() => setActiveTable((p) => (p === tableNum ? null : tableNum))}
            style={{
              ...heatTile,
              background: accuracyColour(acc),
              outline: active ? "2px solid rgba(250,204,21,0.7)" : "1px solid rgba(148,163,184,0.18)",
              transform: active ? "translateY(-1px)" : "translateY(0px)",
            }}
            title={`Table ${tableNum} — ${correct}/${total} correct`}
          >
            <div style={heatTop}>
              <div style={heatLabel}>TABLE</div>
              <div style={heatNum}>{tableNum}</div>
            </div>

            <div style={heatMeta}>
              <div style={heatLine}>
                <span style={heatKey}>Correct</span>
                <span style={heatVal}>{correct}/{total}</span>
              </div>
              <div style={heatLine}>
                <span style={heatKey}>Accuracy</span>
                <span style={heatVal}>{typeof acc === "number" ? `${acc}%` : "—"}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function formatDate(iso) {
  try {
    const d = new Date(iso);
    // UK format
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 19);
  }
}

/* ---------------- Styles ---------------- */

const outerStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(250,204,21,0.18) 0, #0b1220 40%, #050816 100%)",
  padding: "1.5rem",
  color: "white",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const shellStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  marginBottom: "1.25rem",
};

const logoCircle = {
  width: "56px",
  height: "56px",
  borderRadius: "999px",
  background: "white",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const kicker = {
  fontSize: "0.8rem",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#cbd5e1",
};

const title = {
  fontSize: "1.65rem",
  fontWeight: 900,
  color: "#facc15",
  marginTop: "0.1rem",
};

const subtitle = {
  fontSize: "0.95rem",
  color: "#94a3b8",
  marginTop: "0.15rem",
};

const homeLink = {
  color: "#93c5fd",
  textDecoration: "underline",
  fontSize: "0.95rem",
  marginTop: "0.45rem",
};

const controlsRow = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  alignItems: "flex-end",
  marginBottom: "1.25rem",
  padding: "1rem",
  borderRadius: "18px",
  background: "rgba(2,6,23,0.65)",
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const controlBlock = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  minWidth: "160px",
};

const label = {
  fontSize: "0.75rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const select = {
  background: "rgba(15,23,42,0.65)",
  color: "white",
  border: "1px solid rgba(148,163,184,0.28)",
  borderRadius: "999px",
  padding: "0.65rem 0.85rem",
  outline: "none",
};

const input = {
  background: "rgba(15,23,42,0.65)",
  color: "white",
  border: "1px solid rgba(148,163,184,0.28)",
  borderRadius: "999px",
  padding: "0.65rem 0.85rem",
  outline: "none",
  width: "100%",
};

const pillButton = {
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: "999px",
  padding: "0.65rem 1rem",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  letterSpacing: "0.12em",
};

const primaryButton = {
  ...pillButton,
  background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  border: "none",
};

const drillBanner = {
  marginBottom: "1.25rem",
  padding: "0.9rem 1rem",
  borderRadius: "16px",
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.35)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
};

const exitButton = {
  ...pillButton,
  background: "rgba(15,23,42,0.65)",
};

const errorBox = {
  marginBottom: "1rem",
  padding: "0.9rem 1rem",
  borderRadius: "16px",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.35)",
  color: "#fecaca",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.75fr",
  gap: "1rem",
};

const card = {
  background: "rgba(2,6,23,0.72)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: "18px",
  padding: "1.1rem",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const cardTitle = {
  fontSize: "1.25rem",
  fontWeight: 900,
  color: "#facc15",
};

const cardSub = {
  marginTop: "0.35rem",
  color: "#cbd5e1",
  fontSize: "0.92rem",
  lineHeight: 1.35,
};

const tableWrap = {
  overflowX: "auto",
  marginTop: "0.9rem",
  borderRadius: "14px",
  border: "1px solid rgba(148,163,184,0.12)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "720px",
};

const th = {
  textAlign: "left",
  padding: "0.8rem",
  fontSize: "0.8rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#cbd5e1",
  background: "rgba(15,23,42,0.65)",
};

const td = {
  padding: "0.85rem 0.8rem",
  verticalAlign: "middle",
};

const tdMuted = {
  padding: "1rem",
  color: "#94a3b8",
};

const badge = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  borderRadius: "999px",
  border: "1px solid rgba(148,163,184,0.22)",
  padding: "0.25rem 0.6rem",
  fontWeight: 900,
  background: "rgba(2,6,23,0.35)",
};

const emptyBox = {
  marginTop: "1rem",
  padding: "0.9rem",
  borderRadius: "14px",
  border: "1px dashed rgba(148,163,184,0.28)",
  color: "#94a3b8",
};

const trendRow = {
  display: "grid",
  gridTemplateColumns: "110px 1fr 60px",
  gap: "0.6rem",
  alignItems: "center",
};

const trendDay = {
  fontSize: "0.9rem",
  color: "#e2e8f0",
};

const trendBarOuter = {
  height: "10px",
  borderRadius: "999px",
  background: "rgba(15,23,42,0.75)",
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.18)",
};

const trendBarInner = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
  transition: "width 0.25s ease-out",
};

const trendPct = {
  fontWeight: 900,
  textAlign: "right",
  color: "#e2e8f0",
};

const heatWrap = {
  marginTop: "0.9rem",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "0.75rem",
};

const heatTile = {
  width: "100%",
  minHeight: "108px",
  borderRadius: "16px",
  padding: "0.75rem",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  textAlign: "left",
};

const heatTop = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const heatLabel = {
  fontSize: "0.7rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#e2e8f0",
  opacity: 0.9,
};

const heatNum = {
  fontSize: "1.55rem",
  fontWeight: 1000,
  color: "#f8fafc",
};

const heatMeta = {
  marginTop: "0.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const heatLine = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.5rem",
};

const heatKey = {
  fontSize: "0.78rem",
  color: "#e2e8f0",
  opacity: 0.9,
};

const heatVal = {
  fontSize: "0.85rem",
  fontWeight: 900,
  color: "#f8fafc",
};
