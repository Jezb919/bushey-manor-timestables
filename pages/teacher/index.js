import { useEffect, useMemo, useState } from "react";

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

export default function TeacherDashboard() {
  const [scope, setScope] = useState("class"); // class | year | school
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(DEFAULT_DAYS);

  const [search, setSearch] = useState("");
  const [top10, setTop10] = useState(false);

  // Student drilldown
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState(null);

  // Heatmap click
  const [selectedTableNum, setSelectedTableNum] = useState(null);

  // Data
  const [overview, setOverview] = useState(null);
  const [heat, setHeat] = useState(null);
  const [breakdown, setBreakdown] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

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
    }

    return p;
  }, [effectiveScope, days, selectedStudentId, classLabel, year]);

  const overviewUrl = useMemo(
    () => `/api/teacher/overview?${baseParams.toString()}`,
    [baseParams]
  );

  const heatUrl = useMemo(
    () => `/api/teacher/heatmap?${baseParams.toString()}`,
    [baseParams]
  );

  const breakdownUrl = useMemo(() => {
    if (!selectedTableNum) return null;
    const p = new URLSearchParams(baseParams.toString());
    p.set("table_num", String(selectedTableNum));
    return `/api/teacher/table_breakdown?${p.toString()}`;
  }, [baseParams, selectedTableNum]);

  const refreshAll = async () => {
    setLoading(true);
    setErr(null);

    try {
      const [oRes, hRes] = await Promise.all([fetch(overviewUrl), fetch(heatUrl)]);
      const oJson = await oRes.json();
      const hJson = await hRes.json();

      if (!oRes.ok || !oJson.ok) throw new Error(oJson?.details || oJson?.error || "Overview failed");
      if (!hRes.ok || !hJson.ok) throw new Error(hJson?.details || hJson?.error || "Heatmap failed");

      setOverview(oJson);
      setHeat(hJson);
    } catch (e) {
      setErr(e.message || String(e));
      setOverview(null);
      setHeat(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshBreakdown = async () => {
    if (!breakdownUrl) {
      setBreakdown(null);
      return;
    }
    try {
      const r = await fetch(breakdownUrl);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.details || j?.error || "Breakdown failed");
      setBreakdown(j);
    } catch (e) {
      setBreakdown(null);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewUrl, heatUrl]);

  useEffect(() => {
    refreshBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdownUrl]);

  useEffect(() => {
    setSelectedTableNum(null);
    setBreakdown(null);
  }, [effectiveScope, classLabel, year, days, selectedStudentId]);

  const rowsAll = overview?.leaderboard || [];
  const trend = overview?.classTrend || [];
  const tableHeat = heat?.tableHeat || [];
  const breakdownRows = breakdown?.breakdown || [];

  // ---------- CLASS LEADERBOARD BANDS ----------
  // Works for ANY total (10–60). Uses % but labels match your 25-question example.
  const bandFromScore = (score, total) => {
    if (typeof score !== "number" || typeof total !== "number" || total <= 0) {
      return { label: "—", colour: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.22)" };
    }

    if (score === total) {
      return { label: "FULL MARKS", colour: "#22c55e", bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.45)" };
    }

    const pct = (score / total) * 100;

    // Map your 25-Q bands to percentage ranges
    if (pct >= 80) return { label: "20–24", colour: "#60a5fa", bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.38)" };
    if (pct >= 60) return { label: "15–19", colour: "#facc15", bg: "rgba(250,204,21,0.12)", border: "rgba(250,204,21,0.36)" };
    if (pct >= 40) return { label: "10–14", colour: "#fb923c", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.36)" };
    return { label: "<10", colour: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.36)" };
  };

  // Band counts (for a “band summary” box)
  const bandCounts = useMemo(() => {
    const counts = {
      FULL: 0,
      B20: 0,
      B15: 0,
      B10: 0,
      LOW: 0,
      NONE: 0,
    };

    for (const r of rowsAll) {
      const score = r.score;
      const total = r.total;

      if (typeof score !== "number" || typeof total !== "number" || total <= 0) {
        counts.NONE += 1;
        continue;
      }

      if (score === total) counts.FULL += 1;
      else {
        const pct = (score / total) * 100;
        if (pct >= 80) counts.B20 += 1;
        else if (pct >= 60) counts.B15 += 1;
        else if (pct >= 40) counts.B10 += 1;
        else counts.LOW += 1;
      }
    }

    return counts;
  }, [rowsAll]);

  // Search/top10 filter
  const leaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? rowsAll.filter((r) => String(r.student || "").toLowerCase().includes(q))
      : rowsAll.slice();

    // Sort by percent desc, then score desc
    list.sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      if (bp !== ap) return bp - ap;

      const as = typeof a.score === "number" ? a.score : -1;
      const bs = typeof b.score === "number" ? b.score : -1;
      return bs - as;
    });

    if (top10 && list.length) {
      const n = Math.max(1, Math.ceil(list.length * 0.1));
      list = list.slice(0, n);
    }
    return list;
  }, [rowsAll, search, top10]);

  const pageTitle = useMemo(() => {
    if (selectedStudentId && selectedStudentName) return `Student: ${selectedStudentName}`;
    if (scope === "class") return `Class: ${classLabel}`;
    if (scope === "year") return `Year: ${year}`;
    return "Whole School";
  }, [selectedStudentId, selectedStudentName, scope, classLabel, year]);

  const heatColour = (acc) => {
    if (acc === null || typeof acc !== "number") return "rgba(148,163,184,0.10)";
    if (acc >= 90) return "rgba(34,197,94,0.28)";
    if (acc >= 70) return "rgba(59,130,246,0.24)";
    if (acc >= 50) return "rgba(250,204,21,0.22)";
    if (acc >= 30) return "rgba(249,115,22,0.22)";
    return "rgba(239,68,68,0.22)";
  };

  const labelBand = (acc) => {
    if (acc === null || typeof acc !== "number") return { t: "NO DATA", c: "#94a3b8" };
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
          <a href="/" style={homeLink}>Home</a>
        </div>

        {/* Controls */}
        <div style={controls}>
          <div style={control}>
            <label style={label}>SCOPE</label>
            <select
              value={scope}
              onChange={(e) => { setScope(e.target.value); setSelectedStudentId(null); setSelectedStudentName(null); }}
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
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={select}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </div>

          <div style={{ ...control, flex: 1 }}>
            <label style={label}>SEARCH</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" style={input} />
          </div>

          <button type="button" onClick={() => setTop10((p) => !p)} style={{ ...pill, background: top10 ? "rgba(250,204,21,0.18)" : "rgba(148,163,184,0.12)" }}>
            TOP 10%
          </button>

          <button type="button" onClick={refreshAll} style={primary}>
            REFRESH
          </button>
        </div>

        {selectedStudentId && (
          <div style={banner}>
            <div>
              <strong>Student view:</strong> {selectedStudentName}
              <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "0.15rem" }}>
                Click “Exit” to return to {scope}.
              </div>
            </div>
            <button type="button" onClick={() => { setSelectedStudentId(null); setSelectedStudentName(null); }} style={pill}>
              Exit
            </button>
          </div>
        )}

        {err && (
          <div style={errorBox}>
            <strong>Error:</strong> {err}
          </div>
        )}

        {/* NEW: BAND SUMMARY */}
        <div style={bandSummary}>
          <BandChip colour="#22c55e" label="Full marks" value={bandCounts.FULL} />
          <BandChip colour="#60a5fa" label="20–24 band" value={bandCounts.B20} />
          <BandChip colour="#facc15" label="15–19 band" value={bandCounts.B15} />
          <BandChip colour="#fb923c" label="10–14 band" value={bandCounts.B10} />
          <BandChip colour="#ef4444" label="Below 10" value={bandCounts.LOW} />
          <BandChip colour="#94a3b8" label="No data" value={bandCounts.NONE} />
        </div>

        <div style={grid}>
          {/* Leaderboard */}
          <div style={card}>
            <div style={cardTitle}>Class Leaderboard</div>
            <div style={cardSub}>
              Bands are <strong>percentage-based</strong> so they still work when total questions changes (10–60),
              but the labels match your 25-question bands.
            </div>

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>STUDENT</th>
                    <th style={th}>LATEST</th>
                    <th style={th}>SCORE</th>
                    <th style={th}>BAND</th>
                    <th style={th}>IMPROVEMENT</th>
                    <th style={th}>ATTEMPTS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} style={tdMuted}>Loading…</td></tr>
                  )}

                  {!loading && leaderboard.length === 0 && (
                    <tr><td colSpan={6} style={tdMuted}>No students yet. Run some tests first.</td></tr>
                  )}

                  {!loading && leaderboard.map((r) => {
                    const latest = r.latest_at ? formatDate(r.latest_at) : "—";
                    const scoreText =
                      typeof r.score === "number" && typeof r.total === "number"
                        ? `${r.score}/${r.total}`
                        : "—";

                    const band = bandFromScore(r.score, r.total);
                    const delta = typeof r.delta_percent === "number" ? r.delta_percent : null;

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
                          <div style={{ fontWeight: 900, color: "#f8fafc" }}>{r.student || "—"}</div>
                          <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{r.class_label || "—"}</div>
                        </td>
                        <td style={td}>{latest}</td>
                        <td style={td}>{scoreText}</td>
                        <td style={td}>
                          <span style={{ ...badge, borderColor: band.border }}>
                            <span style={{ color: band.colour, fontWeight: 1000 }}>{band.label}</span>
                          </span>
                        </td>
                        <td style={td}>
                          {delta === null ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            <span style={{ fontWeight: 900, color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                              {delta >= 0 ? `+${delta}%` : `${delta}%`}
                            </span>
                          )}
                        </td>
                        <td style={td}>{r.attempts_in_range ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Heatmap + breakdown */}
          <div style={card}>
            <div style={cardTitle}>Times Table Heatmap (1–19)</div>
            <div style={cardSub}>Click a tile for breakdown.</div>

            {tableHeat.length === 0 ? (
              <div style={emptyBox}>No heatmap data yet.</div>
            ) : (
              <>
                <div style={heatWrap}>
                  {tableHeat.map((cell) => {
                    const t = cell.table_num;
                    const acc = cell.accuracy;
                    const total = cell.total || 0;
                    const correct = cell.correct || 0;
                    const b = labelBand(acc);
                    const selected = selectedTableNum === t;

                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setSelectedTableNum(t)}
                        style={{
                          ...heatTile,
                          background: heatColour(acc),
                          border: selected ? "2px solid rgba(250,204,21,0.85)" : "1px solid rgba(148,163,184,0.18)",
                        }}
                        title={`Table ${t}: ${correct}/${total}`}
                      >
                        <div style={heatTop}>
                          <div style={heatLabel}>TABLE</div>
                          <div style={heatNum}>{t}</div>
                        </div>
                        <div style={heatRow}>
                          <div style={heatBadge(b.c)}>{b.t}</div>
                          <div style={heatPct}>{typeof acc === "number" ? `${acc}%` : "—"}</div>
                        </div>
                        <div style={heatMeta}>
                          <div style={heatLine}>
                            <span style={heatKey}>Correct</span>
                            <span style={heatVal}>{correct}/{total}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={breakPanel}>
                  <div style={breakHeader}>
                    <div>
                      <div style={breakKicker}>Table breakdown</div>
                      <div style={breakTitle}>{selectedTableNum ? `×${selectedTableNum}` : "Click a tile"}</div>
                    </div>
                    {selectedTableNum && (
                      <button type="button" onClick={() => setSelectedTableNum(null)} style={pill}>
                        Clear
                      </button>
                    )}
                  </div>

                  {!selectedTableNum && <div style={emptyBox}>Click a tile above to see breakdown.</div>}

                  {selectedTableNum && breakdownRows.length === 0 && (
                    <div style={emptyBox}>No breakdown data yet for ×{selectedTableNum}.</div>
                  )}

                  {selectedTableNum && breakdownRows.length > 0 && (
                    <div style={breakTableWrap}>
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
                            const b = labelBand(acc);
                            return (
                              <tr key={r.student_id} style={{ background: "rgba(148,163,184,0.06)" }}>
                                <td style={td}><strong>{r.student || "—"}</strong></td>
                                <td style={td}>{r.class_label || "—"}</td>
                                <td style={td}>{r.total ?? 0}</td>
                                <td style={td}>{r.correct ?? 0}</td>
                                <td style={td}>
                                  <span style={{ ...badge, borderColor: "rgba(148,163,184,0.25)" }}>
                                    <span style={{ color: b.c, fontWeight: 1000 }}>{b.t}</span>
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

          {/* Trend */}
          <div style={card}>
            <div style={cardTitle}>Trend</div>
            <div style={cardSub}>Average % per day (last {days} days).</div>

            {trend.length === 0 ? (
              <div style={emptyBox}>No trend data yet.</div>
            ) : (
              <div style={trendStack}>
                {trend.map((t) => {
                  const pct = typeof t.avg_percent === "number" ? t.avg_percent : 0;
                  return (
                    <div key={t.day} style={trendRow}>
                      <div style={trendDay}>{t.day}</div>
                      <div style={trendOuter}>
                        <div style={{ ...trendInner, width: `${Math.max(0, Math.min(100, pct))}%` }} />
                      </div>
                      <div style={trendPct}>{typeof t.avg_percent === "number" ? `${t.avg_percent}%` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BandChip({ colour, label, value }) {
  return (
    <div style={{ ...chip, borderColor: `${colour}66` }}>
      <div style={{ ...dot, background: colour }} />
      <div style={{ color: "#e2e8f0", fontWeight: 900 }}>{label}</div>
      <div style={{ marginLeft: "auto", fontWeight: 1000, color: "#f8fafc" }}>{value}</div>
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
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
const title = { fontSize: "1.65rem", fontWeight: 900, color: "#facc15", marginTop: "0.1rem" };
const subtitle = { fontSize: "0.95rem", color: "#94a3b8", marginTop: "0.15rem" };
const homeLink = { color: "#93c5fd", textDecoration: "underline", fontSize: "0.95rem", marginTop: "0.45rem" };

const controls = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  alignItems: "flex-end",
  marginBottom: "1rem",
  padding: "1rem",
  borderRadius: "18px",
  background: "rgba(2,6,23,0.65)",
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
};

const control = { display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: "160px" };
const label = { fontSize: "0.75rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#94a3b8" };

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

const primary = { ...pill, background: "linear-gradient(135deg,#3b82f6,#60a5fa)", border: "none" };

const banner = {
  marginBottom: "1rem",
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

const bandSummary = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: "0.7rem",
  marginBottom: "1rem",
};

const chip = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.75rem 0.85rem",
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(2,6,23,0.65)",
};

const dot = { width: "10px", height: "10px", borderRadius: "999px" };

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

const cardTitle = { fontSize: "1.25rem", fontWeight: 900, color: "#facc15" };
const cardSub = { marginTop: "0.35rem", color: "#cbd5e1", fontSize: "0.92rem", lineHeight: 1.35 };

const tableWrap = { overflowX: "auto", marginTop: "0.9rem", borderRadius: "14px", border: "1px solid rgba(148,163,184,0.12)" };
const table = { width: "100%", borderCollapse: "collapse", minWidth: "900px" };

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

const trendStack = { display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.9rem" };
const trendRow = { display: "grid", gridTemplateColumns: "110px 1fr 60px", gap: "0.6rem", alignItems: "center" };
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

const heatWrap = { marginTop: "0.9rem", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.75rem" };
const heatTile = {
  width: "100%",
  minHeight: "112px",
  borderRadius: "16px",
  padding: "0.75rem",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  cursor: "pointer",
  textAlign: "left",
};
const heatTop = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" };
const heatLabel = { fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#e2e8f0", opacity: 0.9 };
const heatNum = { fontSize: "1.55rem", fontWeight: 1000, color: "#f8fafc" };
const heatRow = { display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" };
const heatPct = { fontWeight: 1000, color: "#f8fafc" };
const heatMeta = { marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.25rem" };
const heatLine = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" };
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

const breakPanel = { marginTop: "1rem", padding: "1rem", borderRadius: "16px", background: "rgba(2,6,23,0.55)", border: "1px solid rgba(148,163,184,0.18)" };
const breakHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" };
const breakKicker = { fontSize: "0.8rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#94a3b8" };
const breakTitle = { fontSize: "1.25rem", fontWeight: 1000, color: "#facc15" };
const breakTableWrap = { marginTop: "0.9rem", overflowX: "auto", borderRadius: "14px", border: "1px solid rgba(148,163,184,0.12)" };
