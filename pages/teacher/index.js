import { useEffect, useMemo, useState } from "react";

const DEFAULT_CLASS = "M4";
const DEFAULT_YEAR = 4;
const DEFAULT_DAYS = 30;

export default function TeacherDashboard() {
  const [scope, setScope] = useState("class"); // school | year | class | student
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [days, setDays] = useState(DEFAULT_DAYS);

  const [selectedStudent, setSelectedStudent] = useState(null); // {id,name,class_label}
  const [selectedTable, setSelectedTable] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [search, setSearch] = useState("");

  const fetchOverview = async () => {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      qs.set("scope", scope);
      qs.set("days", String(days));

      if (scope === "class") qs.set("class_label", classLabel);
      if (scope === "year") qs.set("year", String(year));
      if (scope === "student" && selectedStudent?.id) qs.set("student_id", selectedStudent.id);

      const res = await fetch(`/api/teacher/overview?${qs.toString()}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load overview");
      }
      setData(json);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  // When scope changes, clear table selection
  useEffect(() => {
    setSelectedTable(null);
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, classLabel, year, days, selectedStudent?.id]);

  const leaderboard = data?.leaderboard || [];
  const tableHeat = data?.tableHeat || [];
  const classTrend = data?.classTrend || [];

  const subtitle = useMemo(() => {
    if (scope === "school") return `Whole school • Last ${days} days`;
    if (scope === "year") return `Year ${year} • Last ${days} days`;
    if (scope === "class") return `Class ${classLabel} • Last ${days} days`;
    if (scope === "student") {
      const s = selectedStudent;
      return s ? `Pupil: ${s.name} (${s.class_label}) • Last ${days} days` : `Pupil • Last ${days} days`;
    }
    return `Last ${days} days`;
  }, [scope, year, classLabel, days, selectedStudent]);

  const selectedTile = useMemo(() => {
    if (!selectedTable) return null;
    return (tableHeat || []).find((t) => Number(t.table_num) === Number(selectedTable)) || null;
  }, [selectedTable, tableHeat]);

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter((r) => String(r.student || "").toLowerCase().includes(q));
  }, [leaderboard, search]);

  const selectStudentAndDrill = (row) => {
    if (!row?.student_id) return;
    setSelectedStudent({
      id: row.student_id,
      name: row.student || "Unknown",
      class_label: row.class_label || "—",
    });
    setScope("student");
  };

  return (
    <div style={page}>
      <div style={wrap}>
        {/* Header */}
        <div style={headerRow}>
          <div style={brand}>
            <div style={logoCircle}>
              <span style={logoText}>BM</span>
            </div>
            <div>
              <div style={kicker}>Teacher dashboard</div>
              <div style={title}>Times Tables Arena</div>
              <div style={subTitle}>{subtitle}</div>
            </div>
          </div>

          <a href="/" style={homeLink}>Home</a>
        </div>

        {/* Scope Tabs */}
        <div style={tabs}>
          <Tab label="School" active={scope === "school"} onClick={() => setScope("school")} />
          <Tab label="Year" active={scope === "year"} onClick={() => setScope("year")} />
          <Tab label="Class" active={scope === "class"} onClick={() => setScope("class")} />
          <Tab
            label="Student"
            active={scope === "student"}
            onClick={() => {
              // Only allow if selectedStudent exists; otherwise keep current scope
              if (selectedStudent?.id) setScope("student");
            }}
            disabled={!selectedStudent?.id}
          />
        </div>

        {/* Controls */}
        <div style={controls}>
          <div style={controlBlock}>
            <div style={label}>Days</div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={select}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>

          {scope === "year" && (
            <div style={controlBlock}>
              <div style={label}>Year</div>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={select}>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>
          )}

          {scope === "class" && (
            <div style={controlBlock}>
              <div style={label}>Class</div>
              <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)} style={select}>
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
          )}

          <div style={controlBlockGrow}>
            <div style={label}>Search pupil</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name…"
              style={searchBox}
            />
          </div>

          <div style={controlBlock}>
            <div style={label}>&nbsp;</div>
            <button onClick={fetchOverview} style={primaryBtn}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {err ? (
          <div style={errorBox}>
            <strong>Error:</strong> {err}
          </div>
        ) : null}

        {/* Layout */}
        <div style={grid}>
          {/* Leaderboard */}
          <div style={panel}>
            <div style={panelTitle}>Leaderboard</div>
            <div style={panelHint}>
              Click a pupil row to drill into <strong>Student</strong> heatmap.
            </div>

            <div style={table}>
              <div style={{ ...row, ...rowHead }}>
                <div>Student</div>
                <div>Latest</div>
                <div>Score</div>
                <div>%</div>
                <div>Attempts</div>
              </div>

              {filteredLeaderboard.map((r) => {
                const pct = typeof r.percent === "number" ? r.percent : null;

                return (
                  <button
                    key={`${r.student_id}-${r.student}`}
                    onClick={() => selectStudentAndDrill(r)}
                    style={{
                      ...rowBtn,
                      ...(r.student_id ? {} : { cursor: "default" }),
                    }}
                    disabled={!r.student_id}
                    title={r.student_id ? "Click to view this pupil" : ""}
                  >
                    <div style={{ fontWeight: 900, textAlign: "left" }}>
                      {r.student || "—"}
                      <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>
                        {r.class_label || "—"}
                      </div>
                    </div>

                    <div style={cellMono}>{r.latest_at ? formatDateTime(r.latest_at) : "—"}</div>

                    <div style={cellMono}>
                      {typeof r.score === "number" && typeof r.total === "number" ? `${r.score}/${r.total}` : "—"}
                    </div>

                    <div>{pct === null ? "—" : <span style={pill(pct)}>{pct}%</span>}</div>

                    <div style={cellMono}>{r.attempts_in_range ?? 0}</div>
                  </button>
                );
              })}
            </div>

            {scope === "student" && selectedStudent?.id && (
              <div style={{ marginTop: 12 }}>
                <button
                  style={secondaryBtn}
                  onClick={() => {
                    // return to class view by default
                    setScope("class");
                  }}
                >
                  ← Back to Class view
                </button>
              </div>
            )}
          </div>

          {/* Heatmap + Trend */}
          <div style={rightCol}>
            <div style={panel}>
              <div style={panelTitle}>Heatmap (Tables 1–19)</div>
              <div style={panelHint}>Click a table to highlight.</div>

              <HeatGrid
                tiles={tableHeat}
                selectedTable={selectedTable}
                onSelectTable={(n) => setSelectedTable((prev) => (prev === n ? null : n))}
              />

              {selectedTile && (
                <div style={detailCard}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    Table {selectedTile.table_num} breakdown
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={detailPill}>
                      Total: <strong>{selectedTile.total}</strong>
                    </span>
                    <span style={detailPill}>
                      Correct: <strong>{selectedTile.correct}</strong>
                    </span>
                    <span style={detailPill}>
                      Accuracy:{" "}
                      <strong>
                        {selectedTile.accuracy === null ? "—" : `${selectedTile.accuracy}%`}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={panel}>
              <div style={panelTitle}>Trend</div>
              <div style={panelHint}>Average % per day.</div>

              {!classTrend.length ? (
                <div style={muted}>No trend data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                  {classTrend
                    .slice()
                    .sort((a, b) => (a.day < b.day ? -1 : 1))
                    .map((t) => (
                      <div key={t.day} style={trendRow}>
                        <div style={cellMono}>{t.day}</div>
                        <div style={trendBarWrap}>
                          <div
                            style={{
                              ...trendBar,
                              width: `${Math.max(0, Math.min(100, t.avg_percent || 0))}%`,
                            }}
                          />
                        </div>
                        <div style={cellMono}>{t.avg_percent ?? "—"}%</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, color: "#64748b", fontSize: 12 }}>
          Next step: we’ll add “per-student table breakdown” panels and then Year + School leaderboards.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tabs ---------------- */

function Tab({ label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...tabBtn,
        ...(active ? tabActive : {}),
        ...(disabled ? tabDisabled : {}),
      }}
    >
      {label}
    </button>
  );
}

/* ---------------- Heatmap grid ---------------- */

function HeatGrid({ tiles, selectedTable, onSelectTable }) {
  const byNum = useMemo(() => {
    const m = new Map();
    (tiles || []).forEach((t) => m.set(Number(t.table_num), t));
    return m;
  }, [tiles]);

  const all = Array.from({ length: 19 }).map((_, i) => {
    const n = i + 1;
    return (
      byNum.get(n) || {
        table_num: n,
        total: 0,
        correct: 0,
        accuracy: null,
      }
    );
  });

  return (
    <div style={heatWrap}>
      {all.map((t) => {
        const acc =
          t.accuracy === null || typeof t.accuracy !== "number" ? null : t.accuracy;

        const isActive = selectedTable === t.table_num;

        return (
          <button
            key={t.table_num}
            onClick={() => onSelectTable(t.table_num)}
            style={{
              ...heatTile,
              background: heatColour(acc),
              ...(isActive ? { outline: "3px solid rgba(59,130,246,0.75)" } : {}),
            }}
          >
            <div style={heatTop}>
              <div style={heatLabel}>TABLE</div>
              <div style={heatNum}>{t.table_num}</div>
            </div>

            <div style={heatStats}>
              <div style={heatSmall}>
                <span style={heatKey}>Correct</span>
                <span style={heatVal}>
                  {t.correct}/{t.total}
                </span>
              </div>

              <div style={heatSmall}>
                <span style={heatKey}>Accuracy</span>
                <span style={heatVal}>
                  {acc === null ? "—" : `${Math.round(acc)}%`}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function heatColour(accuracy) {
  if (accuracy === null) return "rgba(15,23,42,0.55)";
  if (accuracy >= 95) return "rgba(34,197,94,0.25)";
  if (accuracy >= 80) return "rgba(250,204,21,0.24)";
  if (accuracy >= 60) return "rgba(249,115,22,0.22)";
  return "rgba(239,68,68,0.20)";
}

/* ---------------- helpers ---------------- */

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mins}`;
  } catch {
    return iso;
  }
}

function pill(percent) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    background: "rgba(2,6,23,0.55)",
    border: `1px solid rgba(148,163,184,0.35)`,
    color: percent >= 80 ? "#facc15" : "#e5e7eb",
  };
}

/* ---------------- styles ---------------- */

const page = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #0b1220 0, #020617 55%, #000 100%)",
  color: "white",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const wrap = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "28px 18px 40px",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const brand = { display: "flex", gap: 14, alignItems: "center" };

const logoCircle = {
  width: 64,
  height: 64,
  borderRadius: 999,
  background: "#fff",
  border: "3px solid #facc15",
  display: "grid",
  placeItems: "center",
};

const logoText = { fontWeight: 900, fontSize: 20, color: "#0f172a" };

const kicker = {
  fontSize: 12,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#94a3b8",
};
const title = { fontSize: 28, fontWeight: 900, color: "#facc15", lineHeight: 1.05 };
const subTitle = { fontSize: 13, color: "#cbd5e1", marginTop: 6 };

const homeLink = { color: "#93c5fd", textDecoration: "underline", fontWeight: 700 };

const tabs = {
  display: "flex",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const tabBtn = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(2,6,23,0.55)",
  color: "white",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const tabActive = {
  border: "1px solid rgba(250,204,21,0.55)",
  boxShadow: "0 0 0 3px rgba(250,204,21,0.12)",
  color: "#facc15",
};

const tabDisabled = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const controls = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 2fr 0.9fr",
  gap: 12,
  alignItems: "end",
  marginBottom: 18,
};

const controlBlock = { display: "flex", flexDirection: "column", gap: 6 };
const controlBlockGrow = { display: "flex", flexDirection: "column", gap: 6 };

const label = {
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

const select = {
  height: 42,
  borderRadius: 999,
  background: "rgba(2,6,23,0.55)",
  color: "white",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0 14px",
  outline: "none",
};

const searchBox = {
  height: 42,
  borderRadius: 999,
  background: "rgba(2,6,23,0.55)",
  color: "white",
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "0 14px",
  outline: "none",
};

const primaryBtn = {
  height: 42,
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  color: "white",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

const secondaryBtn = {
  height: 40,
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(2,6,23,0.55)",
  color: "#e2e8f0",
  fontWeight: 900,
  cursor: "pointer",
  padding: "0 14px",
};

const errorBox = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.35)",
  marginBottom: 16,
  color: "#fecaca",
};

const grid = { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 };
const rightCol = { display: "flex", flexDirection: "column", gap: 16 };

const panel = {
  background: "rgba(3,7,18,0.8)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
};

const panelTitle = { fontSize: 18, fontWeight: 900, color: "#facc15" };
const panelHint = { marginTop: 6, fontSize: 13, color: "#cbd5e1" };
const muted = { marginTop: 10, color: "#94a3b8", fontSize: 13 };

const table = {
  marginTop: 12,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.15)",
};

const row = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr 0.6fr 0.6fr 0.6fr",
  gap: 10,
  alignItems: "center",
  padding: "10px 12px",
};

const rowHead = {
  background: "rgba(2,6,23,0.55)",
  color: "#e2e8f0",
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const rowBtn = {
  ...row,
  width: "100%",
  border: "none",
  background: "rgba(2,6,23,0.25)",
  borderTop: "1px solid rgba(148,163,184,0.08)",
  color: "white",
  cursor: "pointer",
};

const cellMono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 12,
  color: "#e2e8f0",
};

const heatWrap = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
  gap: 12,
};

const heatTile = {
  minHeight: 132,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
  cursor: "pointer",
  color: "white",
  textAlign: "left",
};

const heatTop = { display: "flex", alignItems: "baseline", justifyContent: "space-between" };
const heatLabel = { fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#cbd5e1", fontWeight: 900 };
const heatNum = { fontSize: 40, fontWeight: 900, lineHeight: 1, color: "#fff" };

const heatStats = { display: "grid", gap: 10, marginTop: 10 };
const heatSmall = { display: "flex", justifyContent: "space-between", gap: 10 };
const heatKey = { fontSize: 13, color: "#cbd5e1", fontWeight: 800 };
const heatVal = { fontSize: 13, color: "#fff", fontWeight: 900 };

const detailCard = {
  marginTop: 14,
  borderRadius: 16,
  background: "rgba(2,6,23,0.55)",
  border: "1px solid rgba(148,163,184,0.18)",
  padding: 14,
};

const detailPill = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.7)",
  color: "#e5e7eb",
  fontSize: 13,
};

const trendRow = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 0.6fr",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(148,163,184,0.12)",
};

const trendBarWrap = {
  height: 12,
  borderRadius: 999,
  background: "rgba(15,23,42,0.7)",
  overflow: "hidden",
};

const trendBar = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
};
