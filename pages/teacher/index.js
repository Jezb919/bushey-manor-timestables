import { useEffect, useMemo, useState } from "react";

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

export default function TeacherDashboard() {
  // Scope: class | year | school
  const [scope, setScope] = useState("class");
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(DEFAULT_DAYS);

  const [search, setSearch] = useState("");
  const [top10, setTop10] = useState(false);

  // Drill down to student
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState(null);

  // Selected table tile (for breakdown)
  const [selectedTableNum, setSelectedTableNum] = useState(null);

  // Overview data (leaderboard + trend)
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewErr, setOverviewErr] = useState(null);

  // Heatmap data (tableHeat)
  const [heat, setHeat] = useState(null);
  const [loadingHeat, setLoadingHeat] = useState(false);
  const [heatErr, setHeatErr] = useState(null);

  // Table breakdown data
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownErr, setBreakdownErr] = useState(null);

  // When a student is selected, we switch to student scope automatically
  const effectiveScope = selectedStudentId ? "student" : scope;

  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("scope", effectiveScope);
    p.set("days", String(days));

    if (effectiveScope === "student") {
      p.set("student_id", selectedStudentId);
    } else if (effectiveScope === "class") {
      p.set("class_label", classLabel);
    } else if (effectiveScope === "year") {
      p.set("year", String(year));
    } else {
      // school: no extra params
    }
    return p;
  }, [effectiveScope, days, selectedStudentId, classLabel, year]);

  const overviewUrl = useMemo(() => {
    const p = new URLSearchParams(baseParams.toString());
    return `/api/teacher/overview?${p.toString()}`;
  }, [baseParams]);

  const heatUrl = useMemo(() => {
    const p = new URLSearchParams(baseParams.toString());
    return `/api/teacher/heatmap?${p.toString()}`;
  }, [baseParams]);

  const breakdownUrl = useMemo(() => {
    if (!selectedTableNum) return null;
    const p = new URLSearchParams(baseParams.toString());
    p.set("table_num", String(selectedTableNum));
    return `/api/teacher/table_breakdown?${p.toString()}`;
  }, [baseParams, selectedTableNum]);

  const refreshOverviewAndHeat = async () => {
    // Overview
    setLoadingOverview(true);
    setOverviewErr(null);
    try {
      const r = await fetch(overviewUrl);
      const j = await r.json();
      if (!r.ok || !j.ok)
        throw new Error(j?.details || j?.error || "Overview failed");
      setOverview(j);
    } catch (e) {
      setOverviewErr(e.message || String(e));
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }

    // Heatmap
    setLoadingHeat(true);
    setHeatErr(null);
    try {
      const r = await fetch(heatUrl);
      const j = await r.json();
      if (!r.ok || !j.ok)
        throw new Error(j?.details || j?.error || "Heatmap failed");
      setHeat(j);
    } catch (e) {
      setHeatErr(e.message || String(e));
      setHeat(null);
    } finally {
      setLoadingHeat(false);
    }
  };

  const refreshBreakdown = async () => {
    if (!breakdownUrl) {
      setBreakdown(null);
      setBreakdownErr(null);
      return;
    }
    setLoadingBreakdown(true);
    setBreakdownErr(null);
    try {
      const r = await fetch(breakdownUrl);
      const j = await r.json();
      if (!r.ok || !j.ok)
        throw new Error(j?.details || j?.error || "Breakdown failed");
      setBreakdown(j);
    } catch (e) {
      setBreakdownErr(e.message || String(e));
      setBreakdown(null);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  // Refresh overview + heat on URL changes
  useEffect(() => {
    refreshOverviewAndHeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewUrl, heatUrl]);

  // Refresh breakdown when selected table or scope changes
  useEffect(() => {
    refreshBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdownUrl]);

  // Clear breakdown when changing scope/student
  useEffect(() => {
    setSelectedTableNum(null);
    setBreakdown(null);
    setBreakdownErr(null);
  }, [effectiveScope, classLabel, year, days, selectedStudentId]);

  const leaderboard = useMemo(() => {
    const rows = (overview?.leaderboard || []).slice();
    const q = search.trim().toLowerCase();

    let filtered = q
      ? rows.filter((r) => String(r.student || "").toLowerCase().includes(q))
      : rows;

    filtered.sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      return bp - ap;
    });

    if (top10 && filtered.length) {
      const n = Math.max(1, Math.ceil(filtered.length * 0.1));
      filtered = filtered.slice(0, n);
    }
    return filtered;
  }, [overview, search, top10]);

  const trend = overview?.classTrend || [];
  const tableHeat = heat?.tableHeat || [];
  const breakdownRows = breakdown?.breakdown || [];

  const pageTitle = useMemo(() => {
    if (selectedStudentId && selectedStudentName)
      return `Student: ${selectedStudentName}`;
    if (scope === "class") return `Class: ${classLabel}`;
    if (scope === "year") return `Year: ${year}`;
    return "Whole School";
  }, [selectedStudentId, selectedStudentName, scope, classLabel, year]);

  const bandForPercent = (p) => {
    if (typeof p !== "number")
      return {
        bg: "rgba(148,163,184,0.08)",
        border: "rgba(148,163,184,0.18)",
        tag: "—",
      };
    if (p >= 100)
      return {
        bg: "rgba(34,197,94,0.18)",
        border: "rgba(34,197,94,0.40)",
        tag: "FULL",
      };
    if (p >= 80)
      return {
        bg: "rgba(59,130,246,0.16)",
        border: "rgba(59,130,246,0.35)",
        tag: "HIGH",
      };
    if (p >= 60)
      return {
        bg: "rgba(250,204,21,0.14)",
        border: "rgba(250,204,21,0.35)",
        tag: "OK",
      };
    if (p >= 40)
      return {
        bg: "rgba(249,115,22,0.14)",
        border: "rgba(249,115,22,0.35)",
        tag: "LOW",
      };
    return {
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.35)",
      tag: "RISK",
    };
  };

  const heatColour = (acc) => {
    if (acc === null || typeof acc !== "number")
      return "rgba(148,163,184,0.10)";
    if (acc >= 90) return "rgba(34,197,94,0.28)";
    if (acc >= 70) return "rgba(59,130,246,0.24)";
    if (acc >= 50) return "rgba(250,204,21,0.22)";
    if (acc >= 30) return "rgba(249,115,22,0.22)";
    return "rgba(239,68,68,0.22)";
  };

  const labelBand = (acc) => {
    if (acc === null || typeof acc !== "number")
      return { t: "NO DATA", c: "#94a3b8" };
    if (acc >= 90) return { t: "STRONG", c: "#22c55e" };
    if (acc >= 70) return { t: "GOOD", c: "#60a5fa" };
    if (acc >= 50) return { t: "OK", c: "#facc15" };
    if (acc >= 30) return { t: "WEAK", c: "#fb923c" };
    return { t: "RISK", c: "#ef4444" };
  };

  return (
    <div style={outer}>
      <div style={shell}>
        <div style={topBar}>
          <div style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
            <div style={logoCircle}>
              <span style={{ fontWeight: 900, color: "#0f172a" }}>BM</span>
            </div>
            <div>
              <div style={kicker}>TEACHER DASHBOARD</div>
              <div style={title}>Times Tables Arena</div>
              <div style={subtitle}>{pageTitle}</div>
            </div>
          </div>
          <a href="/" style={homeLink}>
            Home
          </a>
        </div>

        {/* Controls */}
        <div style={controls}>
          <div style={control}>
            <label style={label}>SCOPE</label>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
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

          <div style={control}>
            <label style={label}>CLASS</label>
            <select
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
              disabled={scope !== "class"}
              style={{ ...select, opacity: scope === "class" ? 1 : 0.5 }}
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

          <div style={control}>
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

          <div style={control}>
            <label style={label}>DAYS</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={select}
            >
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>

          <div style={{ ...control, flex: 1 }}>
            <label style={label}>SEARCH</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name…"
              style={input}
            />
          </div>

          <button
            type="button"
            onClick={() => setTop10((p) => !p)}
            style={{
              ...pill,
              background: top10
                ? "rgba(250,204,21,0.18)"
                : "rgba(148,163,184,0.12)",
            }}
          >
            TOP 10%
          </button>

          <button
            type="button"
            onClick={refreshOverviewAndHeat}
            style={primary}
          >
            REFRESH
          </button>
        </div>

        {/* Student drilldown banner */}
        {selectedStudentId && (
          <div style={banner}>
            <div>
              <strong>Student view:</strong> {selectedStudentName}
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#cbd5e1",
                  marginTop: "0.15rem",
                }}
              >
                Click “Exit” to return to {scope}.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudentId(null);
                setSelectedStudentName(null);
              }}
              style={pill}
            >
              Exit
            </button>
          </div>
        )}

        {(overviewErr || heatErr || breakdownErr) && (
          <div style={errorBox}>
            <strong>Error:</strong> {overviewErr || heatErr || breakdownErr}
          </div>
        )}

        <div style={grid}>
          {/* Leaderboard */}
          <div style={card}>
            <div style={cardTitle}>Leaderboard</div>
            <div style={cardSub}>
              Click a student row to drill down. Colour bands are based on latest
              %.
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
                  {(loadingOverview || loadingHeat) && (
                    <tr>
                      <td colSpan={5} style={tdMuted}>
                        Loading…
                      </td>
                    </tr>
                  )}

                  {!loadingOverview && leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={5} style={tdMuted}>
                        No students yet. Run a few tests first.
                      </td>
                    </tr>
                  )}

                  {!loadingOverview &&
                    leaderboard.map((r) => {
                      const band = bandForPercent(r.percent);
                      const latest = r.latest_at ? formatDate(r.latest_at) : "—";
                      const scoreText =
                        typeof r.score === "number" &&
                        typeof r.total === "number"
                          ? `${r.score}/${r.total}`
                          : "—";
                      const pctText =
                        typeof r.percent === "number" ? `${r.percent}%` : "—";

                      return (
                        <tr
                          key={r.student_id}
                          style={{ background: band.bg, cursor: "pointer" }}
                          onClick={() => {
                            setSelectedStudentId(r.student_id);
                            setSelectedStudentName(r.student || "Student");
                          }}
                          title="Click to drill down"
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 900, color: "#f8fafc" }}>
                              {r.student || "—"}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                              {r.class_label || "—"}
                            </div>
                          </td>
                          <td style={td}>{latest}</td>
                          <td style={td}>{scoreText}</td>
                          <td style={td}>
                            <span style={{ ...badge, borderColor: band.border }}>
                              {pctText}{" "}
                              <span style={{ opacity: 0.8, marginLeft: 8 }}>
                                {band.tag}
                              </span>
                            </span>
                          </td>
                          <td style={td}>{r.attempts_in_range ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend */}
          <div style={card}>
            <div style={cardTitle}>Trend</div>
            <div style={cardSub}>
              Average % per day (last {days} days).
            </div>

            {trend.length === 0 ? (
              <div style={emptyBox}>No trend data yet.</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  marginTop: "0.9rem",
                }}
              >
                {trend
                  .slice()
                  .sort((a, b) => (a.day > b.day ? 1 : -1))
                  .map((t) => {
                    const pct =
                      typeof t.avg_percent === "number" ? t.avg_percent : 0;
                    return (
                      <div key={t.day} style={trendRow}>
                        <div style={trendDay}>{t.day}</div>
                        <div style={trendOuter}>
                          <div
                            style={{
                              ...trendInner,
                              width: `${Math.max(0, Math.min(100, pct))}%`,
                            }}
                          />
                        </div>
                        <div style={trendPct}>
                          {typeof t.avg_percent === "number"
                            ? `${t.avg_percent}%`
                            : "—"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Heatmap + Click breakdown */}
          <div style={card}>
            <div style={cardTitle}>Times table heatmap (1–19)</div>
            <div style={cardSub}>
              Click a tile to see which pupils are weakest/strongest on that
              table.
            </div>

            {loadingHeat && <div style={emptyBox}>Loading heatmap…</div>}

            {!loadingHeat && tableHeat.length === 0 && (
              <div style={emptyBox}>
                No heatmap data yet. Run a few tests.
              </div>
            )}

            {!loadingHeat && tableHeat.length > 0 && (
              <>
                <div style={heatWrap}>
                  {tableHeat.map((cell) => {
                    const t = cell.table_num;
                    const acc = cell.accuracy;
                    const total = cell.total || 0;
                    const correct = cell.correct || 0;

                    const band = labelBand(acc);
                    const selected = selectedTableNum === t;

                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setSelectedTableNum(t)}
                        style={{
                          ...heatTile,
                          background: heatColour(acc),
                          border: selected
                            ? "2px solid rgba(250,204,21,0.85)"
                            : "1px solid rgba(148,163,184,0.18)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        title={`Table ${t} — ${correct}/${total} correct`}
                      >
                        <div style={heatTop}>
                          <div style={heatLabel}>TABLE</div>
                          <div style={heatNum}>{t}</div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          }}
                        >
                          <div style={heatBadge(band.c)}>{band.t}</div>
                          <div style={{ fontWeight: 900, color: "#f8fafc" }}>
                            {typeof acc === "number" ? `${acc}%` : "—"}
                          </div>
                        </div>

                        <div style={heatMeta}>
                          <div style={heatLine}>
                            <span style={heatKey}>Correct</span>
                            <span style={heatVal}>
                              {correct}/{total}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Breakdown panel */}
                <div style={breakPanel}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Table breakdown
                      </div>
                      <div
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: 1000,
                          color: "#facc15",
                        }}
                      >
                        {selectedTableNum ? `×${selectedTableNum}` : "Click a tile"}
                      </div>
                      {breakdown?.summary && selectedTableNum && (
                        <div
                          style={{
                            marginTop: "0.25rem",
                            color: "#cbd5e1",
                            fontSize: "0.95rem",
                          }}
                        >
                          Scope accuracy:{" "}
                          <strong>
                            {typeof breakdown.summary.accuracy === "number"
                              ? `${breakdown.summary.accuracy}%`
                              : "—"}
                          </strong>{" "}
                          ({breakdown.summary.correct}/{breakdown.summary.total})
                        </div>
                      )}
                    </div>

                    {selectedTableNum && (
                      <button
                        type="button"
                        onClick={() => setSelectedTableNum(null)}
                        style={pill}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {!selectedTableNum && (
                    <div style={emptyBox}>
                      Click a heatmap tile above to see pupil breakdown.
                    </div>
                  )}

                  {selectedTableNum && loadingBreakdown && (
                    <div style={emptyBox}>Loading breakdown…</div>
                  )}

                  {selectedTableNum &&
                    !loadingBreakdown &&
                    breakdownRows.length === 0 && (
                      <div style={emptyBox}>
                        No question records for ×{selectedTableNum} in the last{" "}
                        {days} days.
                      </div>
                    )}

                  {selectedTableNum &&
                    !loadingBreakdown &&
                    breakdownRows.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.9rem",
                          overflowX: "auto",
                          borderRadius: "14px",
                          border: "1px solid rgba(148,163,184,0.12)",
                        }}
                      >
                        <table style={{ ...table, minWidth: "620px" }}>
                          <thead>
                            <tr>
                              <th style={th}>STUDENT</th>
                              <th style={th}>CLASS</th>
                              <th style={th}>TOTAL</th>
                              <th style={th}>CORRECT</th>
                              <th style={th}>ACCURACY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdownRows.map((r) => {
                              const acc = r.accuracy;
                              const band = labelBand(acc);

                              return (
                                <tr
                                  key={r.student_id}
                                  style={{ background: "rgba(148,163,184,0.06)" }}
                                >
                                  <td style={td}>
                                    <div
                                      style={{
                                        fontWeight: 900,
                                        color: "#f8fafc",
                                      }}
                                    >
                                      {r.student || "—"}
                                    </div>
                                  </td>
                                  <td style={td}>{r.class_label || "—"}</td>
                                  <td style={td}>{r.total ?? 0}</td>
                                  <td style={td}>{r.correct ?? 0}</td>
                                  <td style={td}>
                                    <span
                                      style={{
                                        ...badge,
                                        borderColor: "rgba(148,163,184,0.25)",
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: band.c,
                                          fontWeight: 1000,
                                        }}
                                      >
                                        {band.t}
                                      </span>
                                      <span style={{ marginLeft: 10, fontWeight: 1000 }}>
                                        {typeof acc === "number" ? `${acc}%` : "—"}
                                      </span>
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
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

/* ---------- Styles ---------- */

const outer = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(250,204,21,0.18) 0, #0b1220 40%, #050816 100%)",
  padding: "1.5rem",
  color: "white",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const shell = { maxWidth: "1200px", margin: "0 auto" };

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
const subtitle = { fontSize: "0.95rem", color: "#94a3b8", marginTop: "0.15rem" };
const homeLink = {
  color: "#93c5fd",
  textDecoration: "underline",
  fontSize: "0.95rem",
  marginTop: "0.45rem",
};

const controls = {
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

const control = {
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

const pill = {
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: "999px",
  padding: "0.65rem 1rem",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  letterSpacing: "0.12em",
  background: "rgba(148,163,184,0.12)",
};

const primary = {
  ...pill,
  background: "linear-gradient(135deg,#3b82f6,#60a5fa)",
  border: "none",
};

const banner = {
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

const errorBox = {
  marginBottom: "1rem",
  padding: "0.9rem 1rem",
  borderRadius: "16px",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.35)",
  color: "#fecaca",
};

const grid = { display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: "1rem" };

const card = {
  background: "rgba(2,6,23,0.72)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: "18px",
  padding: "1.1rem",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const cardTitle = { fontSize: "1.25rem", fontWeight: 900, color: "#facc15" };
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
const table = { width: "100%", borderCollapse: "collapse", minWidth: "720px" };
const th = {
  textAlign: "left",
  padding: "0.8rem",
  fontSize: "0.8rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#cbd5e1",
  background: "rgba(15,23,42,0.65)",
};
const tdMuted = { padding: "1rem", color: "#94a3b8" };
const td = {
  padding: "0.85rem 0.8rem",
  verticalAlign: "middle",
  borderBottom: "1px solid rgba(148,163,184,0.10)",
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
const trendDay = { fontSize: "0.9rem", color: "#e2e8f0" };
const trendOuter = {
  height: "10px",
  borderRadius: "999px",
  background: "rgba(15,23,42,0.75)",
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,0.18)",
};
const trendInner = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg,#22c55e,#facc15,#f97316,#ef4444)",
  transition: "width 0.25s ease-out",
};
const trendPct = { fontWeight: 900, textAlign: "right", color: "#e2e8f0" };

const heatWrap = {
  marginTop: "0.9rem",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "0.75rem",
};

const heatTile = {
  width: "100%",
  minHeight: "112px",
  borderRadius: "16px",
  padding: "0.75rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
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
const heatNum = { fontSize: "1.55rem", fontWeight: 1000, color: "#f8fafc" };
const heatMeta = {
  marginTop: "0.4rem",
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
const heatKey = { fontSize: "0.78rem", color: "#e2e8f0", opacity: 0.9 };
const heatVal = { fontSize: "0.85rem", fontWeight: 900, color: "#f8fafc" };

const heatBadge = (color) => ({
  fontSize: "0.72rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontWeight: 1000,
  padding: "0.25rem 0.5rem",
  borderRadius: "999px",
  background: "rgba(2,6,23,0.35)",
  border: `1px solid ${color}55`,
  color,
});

const breakPanel = {
  marginTop: "1rem",
  padding: "1rem",
  borderRadius: "16px",
  background: "rgba(2,6,23,0.55)",
  border: "1px solid rgba(148,163,184,0.18)",
};

const labelBand = (acc) => {
  if (acc === null || typeof acc !== "number")
    return { t: "NO DATA", c: "#94a3b8" };
  if (acc >= 90) return { t: "STRONG", c: "#22c55e" };
  if (acc >= 70) return { t: "GOOD", c: "#60a5fa" };
  if (acc >= 50) return { t: "OK", c: "#facc15" };
  if (acc >= 30) return { t: "WEAK", c: "#fb923c" };
  return { t: "RISK", c: "#ef4444" };
};

const heatColour = (acc) => {
  if (acc === null || typeof acc !== "number")
    return "rgba(148,163,184,0.10)";
  if (acc >= 90) return "rgba(34,197,94,0.28)";
  if (acc >= 70) return "rgba(59,130,246,0.24)";
  if (acc >= 50) return "rgba(250,204,21,0.22)";
  if (acc >= 30) return "rgba(249,115,22,0.22)";
  return "rgba(239,68,68,0.22)";
};
