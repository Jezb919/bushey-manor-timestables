import { useEffect, useMemo, useState } from "react";

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

export default function TeacherDashboard() {
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [search, setSearch] = useState("");

  // Scope: "class" | "year" | "school"
  const [scope, setScope] = useState("class");

  // Click a student row to drill down their heatmap
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [data, setData] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setErr("");

    try {
      const qs = new URLSearchParams();
      qs.set("class_label", classLabel);
      qs.set("days", String(days));
      qs.set("scope", scope);

      // If a student is selected, ask the API for a per-student heatmap
      if (selectedStudentId) qs.set("student_id", selectedStudentId);

      const res = await fetch(`/api/teacher/overview?${qs.toString()}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load teacher overview");
      }

      setData(json);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLabel, days, scope, selectedStudentId]);

  const leaderboard = data?.leaderboard || [];
  const classTrend = data?.classTrend || [];
  const tableHeat = data?.tableHeat || [];

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter((row) =>
      String(row.student || "").toLowerCase().includes(q)
    );
  }, [leaderboard, search]);

  const top10 = useMemo(() => {
    const rows = [...leaderboard]
      .filter((r) => typeof r.percent === "number")
      .sort((a, b) => b.percent - a.percent);
    const cut = Math.max(1, Math.ceil(rows.length * 0.1));
    return rows.slice(0, cut);
  }, [leaderboard]);

  const improved = useMemo(() => {
    // Simple top 5 improvement: delta_percent desc
    const rows = [...leaderboard]
      .filter((r) => typeof r.delta_percent === "number")
      .sort((a, b) => b.delta_percent - a.delta_percent);
    return rows.slice(0, 5);
  }, [leaderboard]);

  const headingScopeLabel =
    scope === "class" ? `Class ${classLabel}` : scope === "year" ? "Year group" : "Whole school";

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
              <div style={subTitle}>
                {headingScopeLabel}
                {selectedStudentName ? ` • Student: ${selectedStudentName}` : ""}
              </div>
            </div>
          </div>

          <a href="/" style={homeLink}>Home</a>
        </div>

        {/* Controls */}
        <div style={controls}>
          <div style={controlBlock}>
            <div style={label}>Scope</div>
            <div style={segRow}>
              <SegButton active={scope === "class"} onClick={() => { setScope("class"); setSelectedStudentId(null); setSelectedStudentName(""); }}>
                Class
              </SegButton>
              <SegButton active={scope === "year"} onClick={() => { setScope("year"); setSelectedStudentId(null); setSelectedStudentName(""); }}>
                Year
              </SegButton>
              <SegButton active={scope === "school"} onClick={() => { setScope("school"); setSelectedStudentId(null); setSelectedStudentName(""); }}>
                Whole school
              </SegButton>
            </div>
          </div>

          <div style={controlBlock}>
            <div style={label}>Class</div>
            <select
              value={classLabel}
              onChange={(e) => { setClassLabel(e.target.value); setSelectedStudentId(null); setSelectedStudentName(""); }}
              style={select}
              disabled={scope !== "class"}
              title={scope !== "class" ? "Class is only used in Class scope" : ""}
            >
              {/* You can add more classes here */}
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
            <div style={label}>Days (trend)</div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={select}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>

          <div style={controlBlockGrow}>
            <div style={label}>Search</div>
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
            <strong>Couldn’t load dashboard:</strong> {err}
          </div>
        ) : null}

        {/* Main grid */}
        <div style={grid}>
          {/* LEFT: leaderboard */}
          <div style={panel}>
            <div style={panelTitle}>Leaderboard</div>
            <div style={panelHint}>
              Click a student row to view their heatmap. (Click again to clear.)
            </div>

            <div style={table}>
              <div style={{ ...row, ...rowHead }}>
                <div>Student</div>
                <div>Latest</div>
                <div>Score</div>
                <div>%</div>
                <div>Δ%</div>
                <div>Attempts</div>
              </div>

              {filteredLeaderboard.map((r) => {
                const active = selectedStudentId && r.student_id === selectedStudentId;
                const pct = typeof r.percent === "number" ? r.percent : null;

                return (
                  <button
                    key={`${r.student_id}-${r.student}-${r.class_label}`}
                    onClick={() => {
                      if (selectedStudentId === r.student_id) {
                        setSelectedStudentId(null);
                        setSelectedStudentName("");
                      } else {
                        setSelectedStudentId(r.student_id);
                        setSelectedStudentName(r.student || "");
                      }
                    }}
                    style={{
                      ...rowBtn,
                      ...(active ? rowBtnActive : {}),
                      ...(pct !== null ? bandByPercent(pct, r.total) : {}),
                    }}
                  >
                    <div style={cellStrong}>
                      {r.student || "—"}
                      <div style={cellSub}>{r.class_label || classLabel}</div>
                    </div>
                    <div style={cellMono}>
                      {r.latest_at ? formatDateTime(r.latest_at) : "—"}
                    </div>
                    <div style={cellMono}>
                      {typeof r.score === "number" && typeof r.total === "number"
                        ? `${r.score}/${r.total}`
                        : "—"}
                    </div>
                    <div>
                      {pct === null ? (
                        "—"
                      ) : (
                        <span style={pill(pct)}>{pct}%</span>
                      )}
                    </div>
                    <div style={cellMono}>
                      {typeof r.delta_percent === "number" ? `${r.delta_percent > 0 ? "+" : ""}${r.delta_percent}` : "—"}
                    </div>
                    <div style={cellMono}>{r.attempts_in_range ?? 0}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={panelTitle}>Most improved (top 5)</div>
              {improved.length ? (
                <ul style={list}>
                  {improved.map((r) => (
                    <li key={`imp-${r.student_id}`} style={listItem}>
                      <span style={{ fontWeight: 800 }}>{r.student}</span>{" "}
                      <span style={{ color: "#9ca3af" }}>({r.class_label})</span>{" "}
                      <span style={{ marginLeft: 8, color: "#22c55e", fontWeight: 800 }}>
                        +{r.delta_percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={muted}>Not enough history yet. Run a few more tests first.</div>
              )}
            </div>
          </div>

          {/* RIGHT: trend + heatmap */}
          <div style={rightCol}>
            <div style={panel}>
              <div style={panelTitle}>
                Trend ({days} days)
              </div>
              <div style={panelHint}>Average % per day.</div>

              {!classTrend.length ? (
                <div style={muted}>No trend data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {classTrend.map((t) => (
                    <div key={t.day} style={trendRow}>
                      <div style={cellMono}>{t.day}</div>
                      <div style={trendBarWrap}>
                        <div style={{ ...trendBar, width: `${Math.max(0, Math.min(100, t.avg_percent || 0))}%` }} />
                      </div>
                      <div style={cellMono}>{Math.round(t.avg_percent || 0)}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={panel}>
              <div style={panelTitle}>
                Times table heatmap (1–19)
              </div>
              <div style={panelHint}>
                {selectedStudentName
                  ? `Showing tables for: ${selectedStudentName}`
                  : "Showing tables for current scope."}
              </div>

              <HeatGrid tiles={tableHeat} />

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => { setSelectedStudentId(null); setSelectedStudentName(""); }}
                  style={secondaryBtn}
                  disabled={!selectedStudentId}
                  title={!selectedStudentId ? "No student selected" : "Back to scope heatmap"}
                >
                  Clear student filter
                </button>

                <button
                  onClick={() => alert("Next step: we’ll make tiles open a student table breakdown view.")}
                  style={secondaryBtn}
                >
                  Heatmap drill-down (next)
                </button>
              </div>
            </div>

            <div style={panel}>
              <div style={panelTitle}>Top 10%</div>
              {top10.length ? (
                <ul style={list}>
                  {top10.map((r) => (
                    <li key={`top-${r.student_id}`} style={listItem}>
                      <span style={{ fontWeight: 800 }}>{r.student}</span>{" "}
                      <span style={{ color: "#9ca3af" }}>({r.class_label})</span>{" "}
                      <span style={{ marginLeft: 8, fontWeight: 800, color: "#facc15" }}>
                        {r.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={muted}>No results yet.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
          Tip: the logo 404 is because <code style={code}>/public/bushey-logo.png</code> isn’t in your repo yet — not critical.
        </div>
      </div>
    </div>
  );
}

/* ---------------- Heatmap ---------------- */

function HeatGrid({ tiles }) {
  // tiles format expected: [{table_num, total, correct, accuracy}]
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
        const acc = t.accuracy === null || typeof t.accuracy !== "number" ? null : t.accuracy;
        const bg = heatColour(acc);

        return (
          <div key={t.table_num} style={{ ...heatTile, background: bg }}>
            <div style={heatTop}>
              <div style={heatLabel}>TABLE</div>
              <div style={heatNum}>{t.table_num}</div>
            </div>

            <div style={heatStats}>
              <div style={heatSmall}>
                <span style={heatKey}>Correct</span>
                <span style={heatVal}>{t.correct}/{t.total}</span>
              </div>

              <div style={heatSmall}>
                <span style={heatKey}>Accuracy</span>
                <span style={heatVal}>{acc === null ? "—" : `${Math.round(acc)}%`}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function heatColour(accuracy) {
  // colour-blind friendly-ish gradient bands
  if (accuracy === null) return "rgba(15,23,42,0.55)";
  if (accuracy >= 95) return "rgba(34,197,94,0.22)";   // green
  if (accuracy >= 80) return "rgba(250,204,21,0.22)";  // yellow
  if (accuracy >= 60) return "rgba(249,115,22,0.22)";  // orange
  return "rgba(239,68,68,0.20)";                       // red
}

/* ---------------- UI helpers ---------------- */

function SegButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...segBtn,
        ...(active ? segBtnActive : {}),
      }}
    >
      {children}
    </button>
  );
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}, ${hh}:${mins}:${ss}`;
  } catch {
    return iso;
  }
}

function pill(percent) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    background: "rgba(2,6,23,0.55)",
    border: `1px solid rgba(148,163,184,0.35)`,
    color: percent >= 80 ? "#facc15" : "#e5e7eb",
  };
}

function bandByPercent(percent, total) {
  // your bands: full marks, 20–24, 15–19, 10–14, below 10
  // This uses percent OR (score bands if total 25). We colour by percent so it still works for total=3/10/60 etc.
  if (percent >= 95) return { background: "rgba(34,197,94,0.14)" };      // green
  if (percent >= 80) return { background: "rgba(250,204,21,0.12)" };     // yellow
  if (percent >= 60) return { background: "rgba(249,115,22,0.10)" };     // orange
  return { background: "rgba(239,68,68,0.10)" };                         // red
}

/* ---------------- Styles ---------------- */

const page = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #0b1220 0, #020617 55%, #000 100%)",
  color: "white",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
  marginBottom: 18,
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

const kicker = { fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "#94a3b8" };
const title = { fontSize: 28, fontWeight: 900, color: "#facc15", lineHeight: 1.05 };
const subTitle = { fontSize: 13, color: "#cbd5e1", marginTop: 6 };

const homeLink = { color: "#93c5fd", textDecoration: "underline", fontWeight: 700 };

const controls = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr 2fr 0.9fr",
  gap: 12,
  alignItems: "end",
  marginBottom: 18,
};

const controlBlock = { display: "flex", flexDirection: "column", gap: 6 };
const controlBlockGrow = { display: "flex", flexDirection: "column", gap: 6 };

const label = { fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8" };

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

const segRow = { display: "flex", gap: 8, flexWrap: "wrap" };
const segBtn = {
  height: 42,
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(148,163,184,0.25)",
  color: "#e5e7eb",
  fontWeight: 800,
  cursor: "pointer",
};
const segBtnActive = {
  background: "rgba(59,130,246,0.22)",
  border: "1px solid rgba(59,130,246,0.55)",
  color: "#bfdbfe",
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
  background: "rgba(2,6,23,0.35)",
  color: "#e5e7eb",
  fontWeight: 800,
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

const grid = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr",
  gap: 16,
};

const rightCol = { display: "flex", flexDirection: "column", gap: 16 };

const panel = {
  background: "rgba(3,7,18,0.8)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
};

const panelTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: "#facc15",
};

const panelHint = {
  marginTop: 6,
  fontSize: 13,
  color: "#cbd5e1",
};

const muted = { marginTop: 10, color: "#94a3b8", fontSize: 13 };

const table = { marginTop: 12, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(148,163,184,0.15)" };

const row = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr 0.6fr 0.5fr 0.5fr 0.5fr",
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
  textAlign: "left",
  border: "none",
  cursor: "pointer",
  background: "rgba(2,6,23,0.25)",
  color: "white",
};

const rowBtnActive = {
  outline: "2px solid rgba(59,130,246,0.6)",
};

const cellStrong = { fontWeight: 900 };
const cellSub = { marginTop: 2, fontSize: 12, color: "#94a3b8", fontWeight: 700 };
const cellMono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, color: "#e2e8f0" };

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

const heatWrap = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(128px, 1fr))",
  gap: 12,
};

const heatTile = {
  minHeight: 118,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
};

const heatTop = { display: "flex", alignItems: "baseline", justifyContent: "space-between" };
const heatLabel = { fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#cbd5e1", fontWeight: 900 };
const heatNum = { fontSize: 36, fontWeight: 900, lineHeight: 1, color: "#fff" };

const heatStats = { display: "grid", gap: 8, marginTop: 10 };
const heatSmall = { display: "flex", justifyContent: "space-between", gap: 10 };
const heatKey = { fontSize: 12, color: "#cbd5e1", fontWeight: 800 };
const heatVal = { fontSize: 12, color: "#fff", fontWeight: 900 };

const list = { marginTop: 10, marginBottom: 0, paddingLeft: 18 };
const listItem = { marginBottom: 6, color: "#e5e7eb" };

const code = { background: "rgba(2,6,23,0.55)", padding: "2px 6px", borderRadius: 8, border: "1px solid rgba(148,163,184,0.2)" };
