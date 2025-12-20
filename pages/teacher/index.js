import { useEffect, useMemo, useState } from "react";

/**
 * Teacher Dashboard (Tabbed)
 * White, cleaner UI
 *
 * Uses existing APIs:
 *  - /api/teacher/overview
 *  - /api/teacher/heatmap
 *  - /api/teacher/table_breakdown
 *
 * Settings are saved to localStorage (browser)
 * Next step (after this): wire student test to read these settings.
 */

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

const SETTINGS_KEY = "bmtt_settings_v1";
const defaultSettings = {
  questionCount: 25, // 10–60
  questionSeconds: 6, // 3–6
};

export default function TeacherDashboard() {
  // Tabs
  const [tab, setTab] = useState("leaderboard"); // leaderboard | improved | heatmap | trend | settings

  // Scope filters
  const [scope, setScope] = useState("class"); // class | year | school
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(DEFAULT_DAYS);

  // Search + top10 toggle (for leaderboard)
  const [search, setSearch] = useState("");
  const [top10, setTop10] = useState(false);

  // Heatmap breakdown selection
  const [selectedTableNum, setSelectedTableNum] = useState(null);
  const [breakdown, setBreakdown] = useState(null);

  // Data
  const [overview, setOverview] = useState(null);
  const [heat, setHeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Settings state (localStorage)
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState("");

  // Load settings once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({
          questionCount:
            typeof parsed.questionCount === "number"
              ? clamp(parsed.questionCount, 10, 60)
              : defaultSettings.questionCount,
          questionSeconds:
            typeof parsed.questionSeconds === "number"
              ? clamp(parsed.questionSeconds, 3, 6)
              : defaultSettings.questionSeconds,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = () => {
    const safe = {
      questionCount: clamp(Number(settings.questionCount || 25), 10, 60),
      questionSeconds: clamp(Number(settings.questionSeconds || 6), 3, 6),
    };
    setSettings(safe);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    setSettingsSavedMsg("Saved ✅");
    setTimeout(() => setSettingsSavedMsg(""), 1500);
  };

  // Build query params for APIs
  const baseParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("scope", scope);
    p.set("days", String(days));
    if (scope === "class") p.set("class_label", classLabel);
    if (scope === "year") p.set("year", String(year));
    return p;
  }, [scope, days, classLabel, year]);

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

  // Fetch overview+heatmap together
  const refreshAll = async () => {
    setLoading(true);
    setErr(null);

    try {
      const [oRes, hRes] = await Promise.all([
        fetch(overviewUrl),
        fetch(heatUrl),
      ]);

      const oJson = await oRes.json();
      const hJson = await hRes.json();

      if (!oRes.ok || !oJson.ok) {
        throw new Error(oJson?.details || oJson?.error || "Overview failed");
      }
      if (!hRes.ok || !hJson.ok) {
        throw new Error(hJson?.details || hJson?.error || "Heatmap failed");
      }

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

  // Refresh whenever scope filters change
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewUrl, heatUrl]);

  // Fetch breakdown when table tile is selected
  useEffect(() => {
    const run = async () => {
      if (!breakdownUrl) {
        setBreakdown(null);
        return;
      }
      try {
        const r = await fetch(breakdownUrl);
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j?.details || j?.error);
        setBreakdown(j);
      } catch {
        setBreakdown(null);
      }
    };
    run();
  }, [breakdownUrl]);

  // Clear breakdown when scope changes
  useEffect(() => {
    setSelectedTableNum(null);
    setBreakdown(null);
  }, [scope, classLabel, year, days]);

  // Derived data
  const rowsAll = overview?.leaderboard || [];
  const trend = overview?.classTrend || [];
  const tableHeat = heat?.tableHeat || [];
  const breakdownRows = breakdown?.breakdown || [];

  const leaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? rowsAll.filter((r) =>
          String(r.student || "").toLowerCase().includes(q)
        )
      : rowsAll.slice();

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

  // Most improved: uses delta_percent if present; otherwise blank
  const mostImproved = useMemo(() => {
    const list = rowsAll
      .filter((r) => typeof r.delta_percent === "number")
      .slice()
      .sort((a, b) => b.delta_percent - a.delta_percent);

    return list;
  }, [rowsAll]);

  const pageSubtitle = useMemo(() => {
    if (scope === "class") return `Class ${classLabel} • last ${days} days`;
    if (scope === "year") return `Year ${year} • last ${days} days`;
    return `Whole school • last ${days} days`;
  }, [scope, classLabel, year, days]);

  return (
    <div style={styles.page}>
      {/* Top header */}
      <div style={styles.topBar}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={styles.logoCircle}>BM</div>
          <div>
            <div style={styles.kicker}>Teacher Dashboard</div>
            <div style={styles.title}>Times Tables Arena</div>
            <div style={styles.subTitle}>{pageSubtitle}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/" style={styles.link}>
            Home
          </a>
          <button onClick={refreshAll} style={styles.primaryBtn} type="button">
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterCard}>
        <FilterSelect
          label="Scope"
          value={scope}
          onChange={(v) => setScope(v)}
          options={[
            { value: "class", label: "Class" },
            { value: "year", label: "Year group" },
            { value: "school", label: "Whole school" },
          ]}
        />

        <FilterSelect
          label="Class"
          value={classLabel}
          onChange={(v) => setClassLabel(v)}
          disabled={scope !== "class"}
          options={[
            { value: "M3", label: "M3" },
            { value: "B3", label: "B3" },
            { value: "M4", label: "M4" },
            { value: "B4", label: "B4" },
            { value: "M5", label: "M5" },
            { value: "B5", label: "B5" },
            { value: "M6", label: "M6" },
            { value: "B6", label: "B6" },
          ]}
        />

        <FilterSelect
          label="Year"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          disabled={scope !== "year"}
          options={[
            { value: "3", label: "Year 3" },
            { value: "4", label: "Year 4" },
            { value: "5", label: "Year 5" },
            { value: "6", label: "Year 6" },
          ]}
        />

        <FilterSelect
          label="Days"
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[
            { value: "7", label: "7" },
            { value: "14", label: "14" },
            { value: "30", label: "30" },
            { value: "60", label: "60" },
            { value: "90", label: "90" },
          ]}
        />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
          Leaderboard
        </TabButton>
        <TabButton active={tab === "improved"} onClick={() => setTab("improved")}>
          Most Improved
        </TabButton>
        <TabButton active={tab === "heatmap"} onClick={() => setTab("heatmap")}>
          Times Table Heat Map
        </TabButton>
        <TabButton active={tab === "trend"} onClick={() => setTab("trend")}>
          Trend
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </TabButton>
      </div>

      {/* Errors */}
      {err && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {err}
        </div>
      )}

      {/* Content */}
      {tab === "leaderboard" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Leaderboard</div>
              <div style={styles.cardSub}>
                Search students, use Top 10%, and see latest results.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name…"
                style={styles.search}
              />
              <button
                type="button"
                onClick={() => setTop10((p) => !p)}
                style={{
                  ...styles.chipBtn,
                  background: top10 ? "#EEF2FF" : "#F8FAFC",
                }}
              >
                TOP 10%
              </button>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Student</th>
                  <th style={styles.th}>Class</th>
                  <th style={styles.th}>Latest</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Percent</th>
                  <th style={styles.th}>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} style={styles.tdMuted}>Loading…</td>
                  </tr>
                )}

                {!loading && leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={6} style={styles.tdMuted}>
                      No data yet — run some student tests.
                    </td>
                  </tr>
                )}

                {!loading &&
                  leaderboard.map((r) => (
                    <tr key={r.student_id}>
                      <td style={styles.tdStrong}>{r.student || "—"}</td>
                      <td style={styles.td}>{r.class_label || "—"}</td>
                      <td style={styles.td}>
                        {r.latest_at ? formatDate(r.latest_at) : "—"}
                      </td>
                      <td style={styles.td}>
                        {typeof r.score === "number" && typeof r.total === "number"
                          ? `${r.score}/${r.total}`
                          : "—"}
                      </td>
                      <td style={styles.td}>
                        {typeof r.percent === "number" ? (
                          <span style={pillForPercent(r.percent)}>{r.percent}%</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={styles.td}>{r.attempts_in_range ?? 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "improved" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Most Improved</div>
              <div style={styles.cardSub}>
                Uses <code>delta_percent</code> (change since previous attempt).
              </div>
            </div>
          </div>

          {loading && <div style={styles.tdMuted}>Loading…</div>}

          {!loading && mostImproved.length === 0 && (
            <div style={styles.tdMuted}>
              No improvements recorded yet (need at least 2 attempts per student).
            </div>
          )}

          {!loading && mostImproved.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Student</th>
                    <th style={styles.th}>Class</th>
                    <th style={styles.th}>Latest %</th>
                    <th style={styles.th}>Change</th>
                    <th style={styles.th}>Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {mostImproved.map((r) => (
                    <tr key={r.student_id}>
                      <td style={styles.tdStrong}>{r.student}</td>
                      <td style={styles.td}>{r.class_label}</td>
                      <td style={styles.td}>
                        {typeof r.percent === "number" ? `${r.percent}%` : "—"}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.deltaPill,
                            color: r.delta_percent >= 0 ? "#16A34A" : "#DC2626",
                            background:
                              r.delta_percent >= 0 ? "#ECFDF5" : "#FEF2F2",
                            borderColor:
                              r.delta_percent >= 0 ? "#BBF7D0" : "#FECACA",
                          }}
                        >
                          {r.delta_percent >= 0 ? "+" : ""}
                          {r.delta_percent}%
                        </span>
                      </td>
                      <td style={styles.td}>{r.attempts_in_range ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "heatmap" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Times Table Heat Map (1–19)</div>
              <div style={styles.cardSub}>
                Click a tile to see breakdown for that table.
              </div>
            </div>
          </div>

          {loading && <div style={styles.tdMuted}>Loading…</div>}

          {!loading && tableHeat.length === 0 && (
            <div style={styles.tdMuted}>No heatmap data yet.</div>
          )}

          {!loading && tableHeat.length > 0 && (
            <>
              <div style={styles.heatGrid}>
                {tableHeat.map((cell) => {
                  const t = cell.table_num;
                  const acc = cell.accuracy;
                  const selected = selectedTableNum === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTableNum(t)}
                      style={{
                        ...styles.heatTile,
                        borderColor: selected ? "#2563EB" : "#E5E7EB",
                        background: heatBg(acc),
                      }}
                      title={`Table ${t}`}
                    >
                      <div style={styles.heatTop}>
                        <div style={styles.heatLabel}>TABLE</div>
                        <div style={styles.heatNum}>{t}</div>
                      </div>
                      <div style={styles.heatMeta}>
                        <div style={styles.heatPct}>
                          {typeof acc === "number" ? `${acc}%` : "—"}
                        </div>
                        <div style={styles.heatSmall}>
                          {cell.correct ?? 0}/{cell.total ?? 0} correct
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={styles.breakPanel}>
                <div style={styles.breakHeader}>
                  <div>
                    <div style={styles.breakKicker}>Table breakdown</div>
                    <div style={styles.breakTitle}>
                      {selectedTableNum ? `×${selectedTableNum}` : "Click a tile"}
                    </div>
                  </div>

                  {selectedTableNum && (
                    <button
                      type="button"
                      onClick={() => setSelectedTableNum(null)}
                      style={styles.chipBtn}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {!selectedTableNum && (
                  <div style={styles.tdMuted}>
                    Click any table tile above to see who is strongest/weakest.
                  </div>
                )}

                {selectedTableNum && breakdownRows.length === 0 && (
                  <div style={styles.tdMuted}>No breakdown data yet for ×{selectedTableNum}.</div>
                )}

                {selectedTableNum && breakdownRows.length > 0 && (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Student</th>
                          <th style={styles.th}>Class</th>
                          <th style={styles.th}>Total</th>
                          <th style={styles.th}>Correct</th>
                          <th style={styles.th}>Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdownRows.map((r) => (
                          <tr key={r.student_id}>
                            <td style={styles.tdStrong}>{r.student || "—"}</td>
                            <td style={styles.td}>{r.class_label || "—"}</td>
                            <td style={styles.td}>{r.total ?? 0}</td>
                            <td style={styles.td}>{r.correct ?? 0}</td>
                            <td style={styles.td}>
                              {typeof r.accuracy === "number" ? (
                                <span style={pillForPercent(r.accuracy)}>
                                  {r.accuracy}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "trend" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Trend</div>
              <div style={styles.cardSub}>Average % per day (last {days} days).</div>
            </div>
          </div>

          {loading && <div style={styles.tdMuted}>Loading…</div>}

          {!loading && trend.length === 0 && (
            <div style={styles.tdMuted}>No trend data yet.</div>
          )}

          {!loading && trend.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trend.map((t) => {
                const pct = typeof t.avg_percent === "number" ? t.avg_percent : 0;
                return (
                  <div key={t.day} style={styles.trendRow}>
                    <div style={styles.trendDay}>{t.day}</div>
                    <div style={styles.trendOuter}>
                      <div style={{ ...styles.trendInner, width: `${clamp(pct, 0, 100)}%` }} />
                    </div>
                    <div style={styles.trendPct}>
                      {typeof t.avg_percent === "number" ? `${t.avg_percent}%` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Settings</div>
              <div style={styles.cardSub}>
                These are saved in your browser. Next we’ll connect these settings
                so student tests automatically use them.
              </div>
            </div>
          </div>

          <div style={styles.settingsGrid}>
            <div style={styles.settingBox}>
              <div style={styles.settingLabel}>Number of questions</div>
              <div style={styles.settingHint}>Min 10 • Max 60</div>

              <input
                type="range"
                min="10"
                max="60"
                value={settings.questionCount}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, questionCount: Number(e.target.value) }))
                }
                style={{ width: "100%", marginTop: 10 }}
              />
              <div style={styles.settingValue}>{settings.questionCount}</div>
            </div>

            <div style={styles.settingBox}>
              <div style={styles.settingLabel}>Time per question (seconds)</div>
              <div style={styles.settingHint}>3 • 4 • 5 • 6</div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                {[3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSettings((p) => ({ ...p, questionSeconds: n }))}
                    style={{
                      ...styles.chipBtn,
                      borderColor: settings.questionSeconds === n ? "#2563EB" : "#E5E7EB",
                      background: settings.questionSeconds === n ? "#EEF2FF" : "#F8FAFC",
                      fontWeight: 800,
                    }}
                  >
                    {n}s
                  </button>
                ))}
              </div>

              <div style={styles.settingValue}>{settings.questionSeconds} seconds</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <button type="button" onClick={saveSettings} style={styles.primaryBtn}>
              Save settings
            </button>
            {settingsSavedMsg && <span style={{ color: "#16A34A", fontWeight: 800 }}>{settingsSavedMsg}</span>}
          </div>

          <div style={styles.noteBox}>
            <strong>Next step (after this):</strong>
            <div style={{ marginTop: 6 }}>
              I’ll update your student test page so it reads these settings and uses:
              <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                <li>{settings.questionCount} questions</li>
                <li>{settings.questionSeconds} seconds per question</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Components ---------------- */

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        background: active ? "#111827" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#111827",
        borderColor: active ? "#111827" : "#E5E7EB",
      }}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options, disabled }) {
  return (
    <div style={{ minWidth: 170 }}>
      <div style={styles.filterLabel}>{label}</div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...styles.select,
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
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

function pillForPercent(pct) {
  const p = clamp(pct, 0, 100);
  let bg = "#F3F4F6";
  let border = "#E5E7EB";
  let col = "#111827";

  if (p >= 90) { bg = "#ECFDF5"; border = "#BBF7D0"; col = "#166534"; }
  else if (p >= 70) { bg = "#EFF6FF"; border = "#BFDBFE"; col = "#1D4ED8"; }
  else if (p >= 50) { bg = "#FFFBEB"; border = "#FDE68A"; col = "#92400E"; }
  else if (p >= 30) { bg = "#FFF7ED"; border = "#FED7AA"; col = "#9A3412"; }
  else { bg = "#FEF2F2"; border = "#FECACA"; col = "#991B1B"; }

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 900,
    border: `1px solid ${border}`,
    background: bg,
    color: col,
    fontSize: "0.9rem",
  };
}

function heatBg(acc) {
  if (acc === null || typeof acc !== "number") return "#F8FAFC";
  if (acc >= 90) return "#ECFDF5";
  if (acc >= 70) return "#EFF6FF";
  if (acc >= 50) return "#FFFBEB";
  if (acc >= 30) return "#FFF7ED";
  return "#FEF2F2";
}

/* ---------------- Styles ---------------- */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F7F7FB",
    padding: "18px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
  },

  topBar: {
    maxWidth: 1150,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "16px 16px",
    background: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
  },

  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    background: "#FACC15",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    color: "#111827",
    border: "1px solid #E5E7EB",
  },

  kicker: {
    fontSize: "0.78rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#6B7280",
    fontWeight: 800,
  },
  title: { fontSize: "1.4rem", fontWeight: 1000, marginTop: 2 },
  subTitle: { color: "#6B7280", marginTop: 2, fontSize: "0.95rem" },

  link: { color: "#2563EB", textDecoration: "underline", fontWeight: 700 },

  primaryBtn: {
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg,#2563EB,#60A5FA)",
  },

  filterCard: {
    maxWidth: 1150,
    margin: "12px auto 0",
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    padding: "14px 16px",
    background: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
  },

  filterLabel: {
    fontSize: "0.78rem",
    fontWeight: 900,
    color: "#6B7280",
    marginBottom: 6,
  },

  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    outline: "none",
  },

  tabs: {
    maxWidth: 1150,
    margin: "12px auto 0",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  tabBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    cursor: "pointer",
    fontWeight: 900,
  },

  card: {
    maxWidth: 1150,
    margin: "12px auto 0",
    padding: 16,
    background: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  cardTitle: { fontSize: "1.2rem", fontWeight: 1000 },
  cardSub: { color: "#6B7280", marginTop: 4, lineHeight: 1.35 },

  search: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    outline: "none",
    minWidth: 220,
  },

  chipBtn: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#F8FAFC",
    cursor: "pointer",
    fontWeight: 900,
  },

  tableWrap: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 840,
  },

  th: {
    textAlign: "left",
    padding: 12,
    fontSize: "0.78rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#6B7280",
    background: "#F8FAFC",
    borderBottom: "1px solid #E5E7EB",
  },

  td: {
    padding: 12,
    borderBottom: "1px solid #F1F5F9",
    verticalAlign: "middle",
    color: "#111827",
  },

  tdStrong: {
    padding: 12,
    borderBottom: "1px solid #F1F5F9",
    fontWeight: 900,
  },

  tdMuted: {
    padding: 12,
    color: "#6B7280",
  },

  errorBox: {
    maxWidth: 1150,
    margin: "12px auto 0",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#991B1B",
    fontWeight: 700,
  },

  heatGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
  },

  heatTile: {
    textAlign: "left",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    padding: 12,
    cursor: "pointer",
    background: "#F8FAFC",
    minHeight: 92,
  },

  heatTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  heatLabel: { fontSize: "0.72rem", letterSpacing: "0.16em", color: "#6B7280", fontWeight: 900 },
  heatNum: { fontSize: "1.35rem", fontWeight: 1000 },
  heatMeta: { marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  heatPct: { fontWeight: 1000 },
  heatSmall: { color: "#6B7280", fontSize: "0.9rem" },

  breakPanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#F8FAFC",
  },

  breakHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  breakKicker: { fontSize: "0.78rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B7280", fontWeight: 900 },
  breakTitle: { fontSize: "1.2rem", fontWeight: 1000 },

  trendRow: { display: "grid", gridTemplateColumns: "110px 1fr 60px", gap: 10, alignItems: "center" },
  trendDay: { color: "#111827", fontWeight: 800 },
  trendOuter: { height: 10, borderRadius: 999, background: "#EEF2FF", overflow: "hidden", border: "1px solid #E5E7EB" },
  trendInner: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22C55E,#FACC15,#FB923C,#EF4444)" },
  trendPct: { textAlign: "right", fontWeight: 900 },

  deltaPill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 1000,
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 14,
  },

  settingBox: {
    border: "1px solid #E5E7EB",
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },

  settingLabel: { fontWeight: 1000, fontSize: "1rem" },
  settingHint: { color: "#6B7280", marginTop: 4 },
  settingValue: { marginTop: 10, fontWeight: 1000, fontSize: "1.15rem" },

  noteBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #BFDBFE",
    background: "#EFF6FF",
    color: "#1E3A8A",
  },
};
