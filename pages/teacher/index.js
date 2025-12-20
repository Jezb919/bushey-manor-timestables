import { useEffect, useMemo, useState } from "react";

/**
 * Teacher Dashboard (Tabbed, white UI)
 *
 * Works with your existing APIs:
 *  - /api/teacher/overview?scope=class&class_label=M4&days=30
 *  - /api/teacher/heatmap?scope=class&class_label=M4&days=30
 *  - /api/teacher/table_breakdown?scope=class&class_label=M4&days=30&table_num=6
 *
 * Includes a Settings tab (B) that stores settings in localStorage (teacher browser).
 * Next step: we wire mixed.js to read these settings automatically.
 */

const DEFAULT_CLASS = "M4";
const DEFAULT_DAYS = 30;

const SETTINGS_KEY = "bmtt_teacher_settings_v2";

const defaultSettings = {
  questionCount: 25, // 10–60
  secondsPerQuestion: 6, // 3–6
  tablesIncluded: Array.from({ length: 19 }, (_, i) => i + 1), // 1–19
};

export default function TeacherDashboard() {
  const [tab, setTab] = useState("overview"); // overview | leaderboard | improved | heatmap | settings

  // Scope filters (these affect the data you view)
  const [scope, setScope] = useState("class"); // class | year | school
  const [classLabel, setClassLabel] = useState(DEFAULT_CLASS);
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(DEFAULT_DAYS);

  // Search
  const [search, setSearch] = useState("");

  // Data
  const [overview, setOverview] = useState(null);
  const [heat, setHeat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Heatmap drilldown
  const [selectedTableNum, setSelectedTableNum] = useState(null);
  const [tableBreakdown, setTableBreakdown] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // Settings (B)
  const [settings, setSettings] = useState(defaultSettings);
  const [savedMsg, setSavedMsg] = useState("");

  // Load settings (teacher browser)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      const safe = {
        questionCount: clampNumber(parsed.questionCount, 10, 60, 25),
        secondsPerQuestion: clampNumber(parsed.secondsPerQuestion, 3, 6, 6),
        tablesIncluded: Array.isArray(parsed.tablesIncluded)
          ? parsed.tablesIncluded
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19)
          : defaultSettings.tablesIncluded,
      };

      if (!safe.tablesIncluded.length) safe.tablesIncluded = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      setSettings(safe);
    } catch {
      // ignore
    }
  }, []);

  const saveSettings = () => {
    const safe = {
      questionCount: clampNumber(settings.questionCount, 10, 60, 25),
      secondsPerQuestion: clampNumber(settings.secondsPerQuestion, 3, 6, 6),
      tablesIncluded: (settings.tablesIncluded || [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19),
    };

    if (!safe.tablesIncluded.length) {
      alert("Please select at least 1 times table (1–19).");
      return;
    }

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    setSettings(safe);
    setSavedMsg("Saved ✅");
    setTimeout(() => setSavedMsg(""), 1400);
  };

  // Query params for API
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

  const refresh = async () => {
    setLoading(true);
    setErrorText("");

    try {
      const [oRes, hRes] = await Promise.all([fetch(overviewUrl), fetch(heatUrl)]);
      const oJson = await oRes.json();
      const hJson = await hRes.json();

      if (!oRes.ok || !oJson.ok) throw new Error(oJson?.details || oJson?.error || "Overview failed");
      if (!hRes.ok || !hJson.ok) throw new Error(hJson?.details || hJson?.error || "Heatmap failed");

      setOverview(oJson);
      setHeat(hJson);
    } catch (e) {
      setOverview(null);
      setHeat(null);
      setErrorText(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Load data when filters change
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewUrl, heatUrl]);

  // Load drilldown when a table tile is selected
  useEffect(() => {
    const run = async () => {
      if (!breakdownUrl) {
        setTableBreakdown(null);
        return;
      }
      setBreakdownLoading(true);
      try {
        const r = await fetch(breakdownUrl);
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j?.details || j?.error || "Breakdown failed");
        setTableBreakdown(j);
      } catch {
        setTableBreakdown(null);
      } finally {
        setBreakdownLoading(false);
      }
    };
    run();
  }, [breakdownUrl]);

  // Clean drilldown when scope changes
  useEffect(() => {
    setSelectedTableNum(null);
    setTableBreakdown(null);
  }, [scope, classLabel, year, days]);

  const subtitle = useMemo(() => {
    if (scope === "class") return `Viewing: Class ${classLabel} • last ${days} days`;
    if (scope === "year") return `Viewing: Year ${year} • last ${days} days`;
    return `Viewing: Whole school • last ${days} days`;
  }, [scope, classLabel, year, days]);

  // Derived lists
  const leaderboardRows = overview?.leaderboard || [];
  const improvedRows = useMemo(() => {
    return (leaderboardRows || [])
      .filter((r) => typeof r.delta_percent === "number")
      .slice()
      .sort((a, b) => b.delta_percent - a.delta_percent);
  }, [leaderboardRows]);

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? leaderboardRows.filter((r) => String(r.student || "").toLowerCase().includes(q))
      : leaderboardRows.slice();

    // Sort by percent desc, then score desc
    list.sort((a, b) => {
      const ap = typeof a.percent === "number" ? a.percent : -1;
      const bp = typeof b.percent === "number" ? b.percent : -1;
      if (bp !== ap) return bp - ap;
      const as = typeof a.score === "number" ? a.score : -1;
      const bs = typeof b.score === "number" ? b.score : -1;
      return bs - as;
    });

    return list;
  }, [leaderboardRows, search]);

  const tableHeat = heat?.tableHeat || [];
  const breakdownRows = tableBreakdown?.breakdown || [];

  return (
    <div style={S.page}>
      {/* Top header */}
      <div style={S.header}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={S.logo}>BM</div>
          <div>
            <div style={S.kicker}>Teacher Dashboard</div>
            <div style={S.title}>Times Tables Arena</div>
            <div style={S.subtitle}>{subtitle}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/" style={S.link}>
            Home
          </a>
          <button type="button" onClick={refresh} style={S.primaryBtn}>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filters}>
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
      <div style={S.tabs}>
        <Tab active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </Tab>
        <Tab active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
          Leaderboard
        </Tab>
        <Tab active={tab === "improved"} onClick={() => setTab("improved")}>
          Most improved
        </Tab>
        <Tab active={tab === "heatmap"} onClick={() => setTab("heatmap")}>
          Times table heat map
        </Tab>
        <Tab active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </Tab>
      </div>

      {errorText && <div style={S.errorBox}><strong>Error:</strong> {errorText}</div>}

      {/* Content */}
      <div style={S.card}>
        {loading && <div style={S.muted}>Loading…</div>}

        {!loading && tab === "overview" && (
          <OverviewPanel overview={overview} />
        )}

        {!loading && tab === "leaderboard" && (
          <div>
            <div style={S.rowBetween}>
              <div>
                <div style={S.h2}>Leaderboard</div>
                <div style={S.muted}>Colour-banded results based on latest score.</div>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name…"
                style={S.search}
              />
            </div>

            <LeaderboardTable rows={filteredLeaderboard} />
          </div>
        )}

        {!loading && tab === "improved" && (
          <div>
            <div style={S.h2}>Most improved</div>
            <div style={S.muted}>Uses delta_percent (needs at least 2 attempts per pupil).</div>
            <div style={{ height: 12 }} />

            {improvedRows.length === 0 ? (
              <div style={S.muted}>No improvement data yet.</div>
            ) : (
              <ImprovedTable rows={improvedRows} />
            )}
          </div>
        )}

        {!loading && tab === "heatmap" && (
          <div>
            <div style={S.rowBetween}>
              <div>
                <div style={S.h2}>Heat map (1–19)</div>
                <div style={S.muted}>Click a tile to open the table breakdown panel.</div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={S.smallBtn}
                  onClick={() => {
                    setSelectedTableNum(null);
                    setTableBreakdown(null);
                  }}
                >
                  Clear selection
                </button>
              </div>
            </div>

            {!tableHeat.length ? (
              <div style={S.muted}>No heatmap data yet.</div>
            ) : (
              <>
                <div style={S.heatGrid}>
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
                          ...S.tile,
                          borderColor: selected ? "#2563EB" : "#E5E7EB",
                          background: tileBg(acc),
                        }}
                      >
                        <div style={S.tileTop}>
                          <div style={S.tileKicker}>TABLE</div>
                          <div style={S.tileNum}>{t}</div>
                        </div>
                        <div style={S.tileBottom}>
                          <div style={S.tilePct}>{typeof acc === "number" ? `${acc}%` : "—"}</div>
                          <div style={S.tileSmall}>
                            {cell.correct ?? 0}/{cell.total ?? 0}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Breakdown panel */}
                <div style={S.breakPanel}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.breakKicker}>Table breakdown</div>
                      <div style={S.breakTitle}>
                        {selectedTableNum ? `×${selectedTableNum}` : "Click a tile above"}
                      </div>
                    </div>
                    {selectedTableNum && (
                      <span style={S.muted}>
                        API: <code>/api/teacher/table_breakdown</code>
                      </span>
                    )}
                  </div>

                  {!selectedTableNum && (
                    <div style={S.muted}>(This panel fills in after you click a tile.)</div>
                  )}

                  {selectedTableNum && breakdownLoading && <div style={S.muted}>Loading breakdown…</div>}

                  {selectedTableNum && !breakdownLoading && (
                    <>
                      {!breakdownRows.length ? (
                        <div style={S.muted}>No breakdown data yet for ×{selectedTableNum}.</div>
                      ) : (
                        <BreakdownTable rows={breakdownRows} />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && tab === "settings" && (
          <div>
            <div style={S.h2}>Settings</div>
            <div style={S.muted}>
              These are saved in the teacher browser for now. Next we’ll connect them to the student test automatically.
            </div>

            <div style={{ height: 14 }} />

            <div style={S.settingsGrid}>
              <div style={S.settingBox}>
                <div style={S.settingTitle}>Number of questions</div>
                <div style={S.muted}>Min 10 • Max 60</div>
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
                <div style={S.settingValue}>{settings.questionCount}</div>
              </div>

              <div style={S.settingBox}>
                <div style={S.settingTitle}>Time per question</div>
                <div style={S.muted}>3 / 4 / 5 / 6 seconds</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  {[3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSettings((p) => ({ ...p, secondsPerQuestion: n }))}
                      style={{
                        ...S.pillBtn,
                        borderColor: settings.secondsPerQuestion === n ? "#2563EB" : "#E5E7EB",
                        background: settings.secondsPerQuestion === n ? "#EEF2FF" : "#FFFFFF",
                      }}
                    >
                      {n}s
                    </button>
                  ))}
                </div>

                <div style={S.settingValue}>{settings.secondsPerQuestion} seconds</div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div style={S.settingBox}>
              <div style={S.settingTitle}>Tables included (1–19)</div>
              <div style={S.muted}>Click to toggle tables on/off.</div>

              <div style={S.tablePickGrid}>
                {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => {
                  const on = settings.tablesIncluded.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setSettings((p) => {
                          const set = new Set(p.tablesIncluded);
                          if (set.has(n)) set.delete(n);
                          else set.add(n);
                          const next = Array.from(set).sort((a, b) => a - b);
                          return { ...p, tablesIncluded: next };
                        });
                      }}
                      style={{
                        ...S.tablePick,
                        borderColor: on ? "#2563EB" : "#E5E7EB",
                        background: on ? "#EEF2FF" : "#FFFFFF",
                        fontWeight: on ? 900 : 700,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>

              <div style={{ height: 10 }} />
              <div style={S.muted}>
                Selected: <strong>{settings.tablesIncluded.join(", ")}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
              <button type="button" onClick={saveSettings} style={S.primaryBtn}>
                Save settings
              </button>
              {savedMsg && <span style={{ color: "#16A34A", fontWeight: 900 }}>{savedMsg}</span>}
            </div>

            <div style={S.note}>
              <strong>Next step (I’ll do after you confirm this page looks right):</strong>
              <div style={{ marginTop: 6 }}>
                Update <code>pages/student/tests/mixed.js</code> so it reads these settings and uses:
                <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                  <li>{settings.questionCount} questions</li>
                  <li>{settings.secondsPerQuestion} seconds per question</li>
                  <li>Only tables: {settings.tablesIncluded.join(", ")}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Small components ---------------- */

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...S.tabBtn,
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
      <div style={S.filterLabel}>{label}</div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...S.select,
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

function OverviewPanel({ overview }) {
  const rows = overview?.leaderboard || [];
  const attempts = rows.reduce((sum, r) => sum + (r.attempts_in_range || 0), 0);

  const percents = rows
    .map((r) => (typeof r.percent === "number" ? r.percent : null))
    .filter((x) => typeof x === "number");

  const avg = percents.length
    ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
    : null;

  const active = rows.filter((r) => (r.attempts_in_range || 0) > 0).length;

  return (
    <div>
      <div style={S.h2}>Overview</div>
      <div style={S.muted}>Quick summary of what’s been recorded in the selected time range.</div>

      <div style={{ height: 14 }} />

      <div style={S.statsGrid}>
        <Stat label="Active pupils" value={active} />
        <Stat label="Total attempts" value={attempts} />
        <Stat label="Average %" value={avg !== null ? `${avg}%` : "—"} />
        <Stat label="Pupils listed" value={rows.length} />
      </div>

      <div style={{ height: 14 }} />
      <div style={S.muted}>
        Tip: Use <strong>Leaderboard</strong> for class bands, and <strong>Heat map</strong> to spot weakest tables.
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={S.stat}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{value}</div>
    </div>
  );
}

function LeaderboardTable({ rows }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Student</th>
            <th style={S.th}>Class</th>
            <th style={S.th}>Latest</th>
            <th style={S.th}>Score</th>
            <th style={S.th}>Band</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={S.tdMuted}>No results yet.</td>
            </tr>
          )}

          {rows.map((r) => {
            const band = bandForScore(r.score, r.total);
            return (
              <tr key={r.student_id}>
                <td style={S.tdStrong}>{r.student || "—"}</td>
                <td style={S.td}>{r.class_label || "—"}</td>
                <td style={S.td}>{r.latest_at ? formatDate(r.latest_at) : "—"}</td>
                <td style={S.td}>
                  {typeof r.score === "number" && typeof r.total === "number"
                    ? `${r.score}/${r.total}`
                    : "—"}
                </td>
                <td style={S.td}>
                  {band ? <span style={band.style}>{band.label}</span> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImprovedTable({ rows }) {
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Student</th>
            <th style={S.th}>Class</th>
            <th style={S.th}>Latest %</th>
            <th style={S.th}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.student_id}>
              <td style={S.tdStrong}>{r.student || "—"}</td>
              <td style={S.td}>{r.class_label || "—"}</td>
              <td style={S.td}>{typeof r.percent === "number" ? `${r.percent}%` : "—"}</td>
              <td style={S.td}>
                <span
                  style={{
                    ...S.deltaPill,
                    color: r.delta_percent >= 0 ? "#16A34A" : "#DC2626",
                    background: r.delta_percent >= 0 ? "#ECFDF5" : "#FEF2F2",
                    borderColor: r.delta_percent >= 0 ? "#BBF7D0" : "#FECACA",
                  }}
                >
                  {r.delta_percent >= 0 ? "+" : ""}
                  {r.delta_percent}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownTable({ rows }) {
  return (
    <div style={{ ...S.tableWrap, marginTop: 12 }}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Student</th>
            <th style={S.th}>Class</th>
            <th style={S.th}>Total</th>
            <th style={S.th}>Correct</th>
            <th style={S.th}>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.student_id}>
              <td style={S.tdStrong}>{r.student || "—"}</td>
              <td style={S.td}>{r.class_label || "—"}</td>
              <td style={S.td}>{r.total ?? 0}</td>
              <td style={S.td}>{r.correct ?? 0}</td>
              <td style={S.td}>
                {typeof r.accuracy === "number" ? (
                  <span style={accuracyPill(r.accuracy)}>{r.accuracy}%</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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

function tileBg(acc) {
  if (acc === null || typeof acc !== "number") return "#F8FAFC";
  if (acc >= 90) return "#ECFDF5";
  if (acc >= 70) return "#EFF6FF";
  if (acc >= 50) return "#FFFBEB";
  if (acc >= 30) return "#FFF7ED";
  return "#FEF2F2";
}

function accuracyPill(pct) {
  const p = Math.max(0, Math.min(100, Number(pct)));
  let bg = "#F3F4F6", border = "#E5E7EB", col = "#111827";
  if (p >= 90) { bg = "#ECFDF5"; border = "#BBF7D0"; col = "#166534"; }
  else if (p >= 70) { bg = "#EFF6FF"; border = "#BFDBFE"; col = "#1D4ED8"; }
  else if (p >= 50) { bg = "#FFFBEB"; border = "#FDE68A"; col = "#92400E"; }
  else if (p >= 30) { bg = "#FFF7ED"; border = "#FED7AA"; col = "#9A3412"; }
  else { bg = "#FEF2F2"; border = "#FECACA"; col = "#991B1B"; }

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color: col,
    fontWeight: 900,
    fontSize: "0.9rem",
  };
}

/**
 * Class leader bands (you asked for these bands):
 * - Full marks
 * - 20–24
 * - 15–19
 * - 10–14
 * - Below 10
 *
 * NOTE: If total isn't 25, we band using percentage approximations.
 */
function bandForScore(score, total) {
  if (typeof score !== "number" || typeof total !== "number" || total <= 0) return null;

  // If total is 25, use your exact bands
  if (total === 25) {
    if (score === 25) return band("Full marks", "#ECFDF5", "#BBF7D0", "#166534");
    if (score >= 20) return band("20–24", "#EFF6FF", "#BFDBFE", "#1D4ED8");
    if (score >= 15) return band("15–19", "#FFFBEB", "#FDE68A", "#92400E");
    if (score >= 10) return band("10–14", "#FFF7ED", "#FED7AA", "#9A3412");
    return band("Below 10", "#FEF2F2", "#FECACA", "#991B1B");
  }

  // Otherwise approximate using percent
  const pct = Math.round((score / total) * 100);
  if (pct >= 95) return band("Full marks-ish", "#ECFDF5", "#BBF7D0", "#166534");
  if (pct >= 80) return band("High", "#EFF6FF", "#BFDBFE", "#1D4ED8");
  if (pct >= 60) return band("Mid", "#FFFBEB", "#FDE68A", "#92400E");
  if (pct >= 40) return band("Low", "#FFF7ED", "#FED7AA", "#9A3412");
  return band("Very low", "#FEF2F2", "#FECACA", "#991B1B");
}

function band(label, bg, border, col) {
  return {
    label,
    style: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      border: `1px solid ${border}`,
      background: bg,
      color: col,
      fontWeight: 900,
      fontSize: "0.9rem",
    },
  };
}

/* ---------------- Styles ---------------- */

const S = {
  page: {
    minHeight: "100vh",
    background: "#F7F7FB",
    padding: 18,
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#111827",
  },

  header: {
    maxWidth: 1150,
    margin: "0 auto",
    padding: 16,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "white",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },

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
  title: { fontSize: "1.4rem", fontWeight: 1000, marginTop: 2 },
  subtitle: { color: "#6B7280", marginTop: 2, fontSize: "0.95rem" },

  link: { color: "#2563EB", textDecoration: "underline", fontWeight: 800 },

  primaryBtn: {
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    color: "white",
    background: "linear-gradient(135deg,#2563EB,#60A5FA)",
  },

  filters: {
    maxWidth: 1150,
    margin: "12px auto 0",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "white",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  filterLabel: { fontSize: "0.78rem", fontWeight: 900, color: "#6B7280", marginBottom: 6 },

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
    fontWeight: 1000,
    background: "white",
  },

  card: {
    maxWidth: 1150,
    margin: "12px auto 0",
    padding: 16,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "white",
    boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
  },

  h2: { fontSize: "1.2rem", fontWeight: 1000 },
  muted: { color: "#6B7280" },

  errorBox: {
    maxWidth: 1150,
    margin: "12px auto 0",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    color: "#991B1B",
    fontWeight: 800,
  },

  rowBetween: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" },

  search: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    outline: "none",
    minWidth: 220,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  stat: {
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: 14,
    background: "#F8FAFC",
  },
  statLabel: { fontSize: "0.8rem", color: "#6B7280", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" },
  statValue: { marginTop: 6, fontSize: "1.5rem", fontWeight: 1000 },

  tableWrap: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    overflowX: "auto",
  },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 860 },
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
  td: { padding: 12, borderBottom: "1px solid #F1F5F9" },
  tdStrong: { padding: 12, borderBottom: "1px solid #F1F5F9", fontWeight: 1000 },
  tdMuted: { padding: 12, color: "#6B7280" },

  deltaPill: { display: "inline-block", padding: "4px 10px", borderRadius: 999, border: "1px solid", fontWeight: 1000 },

  heatGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
  },
  tile: {
    textAlign: "left",
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    padding: 12,
    cursor: "pointer",
    minHeight: 92,
  },
  tileTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  tileKicker: { fontSize: "0.72rem", letterSpacing: "0.16em", color: "#6B7280", fontWeight: 1000 },
  tileNum: { fontSize: "1.35rem", fontWeight: 1000 },
  tileBottom: { marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  tilePct: { fontWeight: 1000 },
  tileSmall: { color: "#6B7280", fontSize: "0.95rem" },

  breakPanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#F8FAFC",
  },
  breakKicker: { fontSize: "0.78rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B7280", fontWeight: 1000 },
  breakTitle: { fontSize: "1.2rem", fontWeight: 1000 },

  smallBtn: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 900,
  },

  settingsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  settingBox: { border: "1px solid #E5E7EB", background: "#F8FAFC", borderRadius: 14, padding: 14 },
  settingTitle: { fontWeight: 1000, fontSize: "1rem" },
  settingValue: { marginTop: 10, fontWeight: 1000, fontSize: "1.15rem" },

  pillBtn: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    cursor: "pointer",
    fontWeight: 900,
  },

  tablePickGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
    gap: 8,
  },
  tablePick: {
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    cursor: "pointer",
    background: "white",
  },

  note: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #BFDBFE",
    background: "#EFF6FF",
    color: "#1E3A8A",
  },
};
