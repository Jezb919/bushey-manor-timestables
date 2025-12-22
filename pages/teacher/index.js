import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active ? "2px solid #0ea5e9" : "1px solid #cbd5e1",
        background: active ? "#e0f2fe" : "white",
        fontWeight: 800,
        cursor: "pointer",
        color: "#0f172a",
      }}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "white",
        fontWeight: 700,
      }}
    >
      {children}
    </select>
  );
}

export default function TeacherHome() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("heatmap"); // heatmap | improved | leaderboard | settings
  const [scope, setScope] = useState("class"); // class | year | school
  const [classLabel, setClassLabel] = useState("");
  const [year, setYear] = useState(4);
  const [days, setDays] = useState(30);

  const availableClasses = useMemo(() => me?.classes || [], [me]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/teacher/me");
      const data = await res.json();
      if (!data.ok || !data.loggedIn) {
        setMe({ loggedIn: false });
        setLoading(false);
        return;
      }
      setMe(data);

      // default class selection: first assigned class if teacher, else first class if admin
      const first = data?.classes?.[0]?.class_label || "";
      setClassLabel(first);
      setLoading(false);
    };
    run();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <Card>
          <h2 style={{ margin: 0 }}>Loading…</h2>
        </Card>
      </PageShell>
    );
  }

  if (!me?.loggedIn) {
    return (
      <PageShell>
        <Card>
          <h1 style={{ marginTop: 0 }}>Teacher Dashboard</h1>
          <p>You are not logged in.</p>
          <Link href="/teacher/login" style={linkStyle}>
            Go to Teacher Login →
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TopBar me={me} />

      <Card>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <TabButton active={tab === "heatmap"} onClick={() => setTab("heatmap")}>
              Times Table Heatmap
            </TabButton>
            <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
              Leaderboard
            </TabButton>
            <TabButton active={tab === "improved"} onClick={() => setTab("improved")}>
              Most Improved
            </TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              Settings
            </TabButton>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="class">Class</option>
              <option value="year">Year Group</option>
              <option value="school">Whole School</option>
            </Select>

            {scope === "class" && (
              <Select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.class_label}>
                    {c.class_label}
                  </option>
                ))}
              </Select>
            )}

            {scope === "year" && (
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                <option value={3}>Year 3</option>
                <option value={4}>Year 4</option>
                <option value={5}>Year 5</option>
                <option value={6}>Year 6</option>
              </Select>
            )}

            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
          </div>
        </div>
      </Card>

      {tab === "heatmap" && (
        <HeatmapPanel scope={scope} classLabel={classLabel} year={year} days={days} />
      )}

      {tab === "leaderboard" && (
        <LeaderboardPanel scope={scope} classLabel={classLabel} year={year} days={days} />
      )}

      {tab === "improved" && (
        <MostImprovedPanel scope={scope} classLabel={classLabel} year={year} days={days} />
      )}

      {tab === "settings" && (
        <SettingsPanel me={me} classLabel={classLabel} />
      )}
    </PageShell>
  );
}

/* ---------------- Panels ---------------- */

function HeatmapPanel({ scope, classLabel, year, days }) {
  const [data, setData] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("scope", scope);
    p.set("days", String(days));
    if (scope === "class") p.set("class_label", classLabel);
    if (scope === "year") p.set("year", String(year));
    return "/api/teacher/heatmap?" + p.toString();
  }, [scope, classLabel, year, days]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setBreakdown(null);
      const res = await fetch(query);
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    run();
  }, [query]);

  const openTable = async (tableNum) => {
    const p = new URLSearchParams();
    p.set("scope", scope);
    p.set("days", String(days));
    p.set("table_num", String(tableNum));
    if (scope === "class") p.set("class_label", classLabel);
    if (scope === "year") p.set("year", String(year));

    const res = await fetch("/api/teacher/table_breakdown?" + p.toString());
    const json = await res.json();
    setBreakdown(json);
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Times Table Heatmap</h2>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Explain: click a tile to see which pupils are strongest/weakest on that table.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : !data?.ok ? (
        <p style={{ color: "#b91c1c" }}>Error: {data?.error || "Unknown"}</p>
      ) : (
        <>
          <HeatGrid tableHeat={data.tableHeat} onClickTable={openTable} />

          {breakdown?.ok && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 8 }}>
                Table {breakdown.table_num} breakdown
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Student</th>
                      <th style={thStyle}>Class</th>
                      <th style={thStyle}>Correct</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.breakdown.map((r) => (
                      <tr key={r.student_id}>
                        <td style={tdStyle}>{r.student}</td>
                        <td style={tdStyle}>{r.class_label}</td>
                        <td style={tdStyle}>{r.correct ?? "-"}</td>
                        <td style={tdStyle}>{r.total ?? "-"}</td>
                        <td style={tdStyle}>
                          {r.accuracy === null ? "-" : r.accuracy + "%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: "#475569", marginTop: 10 }}>
                Summary: {breakdown.summary.correct}/{breakdown.summary.total} (
                {breakdown.summary.accuracy}%)
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function LeaderboardPanel({ scope, classLabel, year, days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("scope", scope);
    p.set("days", String(days));
    if (scope === "class") p.set("class_label", classLabel);
    if (scope === "year") p.set("year", String(year));
    return "/api/teacher/overview?" + p.toString();
  }, [scope, classLabel, year, days]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch(query);
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    run();
  }, [query]);

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Leaderboard</h2>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Latest attempt per student (within range).
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : !data?.ok ? (
        <p style={{ color: "#b91c1c" }}>Error: {data?.error || "Unknown"}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Student</th>
                <th style={thStyle}>Class</th>
                <th style={thStyle}>Latest %</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((r) => (
                <tr key={r.student_id}>
                  <td style={tdStyle}>{r.student}</td>
                  <td style={tdStyle}>{r.class_label}</td>
                  <td style={tdStyle}>
                    {r.percent === null ? "-" : badgePercent(r.percent)}
                  </td>
                  <td style={tdStyle}>
                    {r.score === null ? "-" : `${r.score}/${r.total}`}
                  </td>
                  <td style={tdStyle}>{r.attempts_in_range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MostImprovedPanel({ scope, classLabel, year, days }) {
  // Placeholder panel (we can wire this to a new /api/teacher/improved endpoint next)
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Most Improved</h2>
      <p style={{ color: "#475569" }}>
        Next step: we’ll add an endpoint that compares each pupil’s first vs latest
        attempt in the date range and ranks by improvement.
      </p>
    </Card>
  );
}

function SettingsPanel({ me, classLabel }) {
  const [status, setStatus] = useState(null);
  const [questionCount, setQuestionCount] = useState(25);
  const [seconds, setSeconds] = useState(6);
  const [tables, setTables] = useState(Array.from({ length: 19 }, (_, i) => i + 1));

  // load settings for selected class from server (we will create /api/teacher/settings next)
  useEffect(() => {
    const run = async () => {
      setStatus(null);
      const res = await fetch(
        `/api/teacher/settings?class_label=${encodeURIComponent(classLabel || "")}`
      );
      const json = await res.json();
      if (json?.ok && json?.settings) {
        setQuestionCount(json.settings.question_count ?? 25);
        setSeconds(json.settings.seconds_per_question ?? 6);
        setTables(json.settings.tables_selected ?? Array.from({ length: 19 }, (_, i) => i + 1));
      }
    };
    if (classLabel) run();
  }, [classLabel]);

  const toggleTable = (n) => {
    setTables((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  };

  const save = async () => {
    setStatus("Saving…");
    const res = await fetch("/api/teacher/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_label: classLabel,
        question_count: questionCount,
        seconds_per_question: seconds,
        tables_selected: tables,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setStatus("Save failed: " + (json.error || "Unknown"));
      return;
    }
    setStatus("Saved ✅");
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p style={{ marginTop: 0, color: "#475569" }}>
        These settings apply to the class test students run.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label style={labelStyle}>Class</label>
          <div style={{ fontWeight: 900 }}>{classLabel || "-"}</div>
        </div>

        <div>
          <label style={labelStyle}>Questions (10–60)</label>
          <input
            type="number"
            min={10}
            max={60}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            style={inputSmall}
          />
        </div>

        <div>
          <label style={labelStyle}>Seconds per question (3–6)</label>
          <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} style={inputSmall}>
            <option value={6}>6</option>
            <option value={5}>5</option>
            <option value={4}>4</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>Tables included (1–19)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => {
            const on = tables.includes(n);
            return (
              <button
                key={n}
                onClick={() => toggleTable(n)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: on ? "2px solid #22c55e" : "1px solid #cbd5e1",
                  background: on ? "#dcfce7" : "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={save} style={primaryBtn}>
          Save settings
        </button>
        <span style={{ color: "#475569", fontWeight: 700 }}>{status || ""}</span>
      </div>

      <p style={{ marginTop: 14, color: "#64748b", fontSize: 13 }}>
        Logged in as: <strong>{me?.teacher?.email}</strong> ({me?.teacher?.role})
      </p>
    </Card>
  );
}

/* ---------------- Components / styles ---------------- */

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
        padding: "22px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function TopBar({ me }) {
  return (
    <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg,#0ea5e9,#22c55e)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
          }}
        >
          BM
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.12em" }}>
            TEACHER DASHBOARD
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            Times Tables Arena
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 900 }}>{me?.teacher?.full_name}</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          {me?.teacher?.email} · {me?.teacher?.role}
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 25px 60px rgba(15, 23, 42, 0.10)",
        padding: 18,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function HeatGrid({ tableHeat, onClickTable }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {tableHeat.map((cell) => {
        const acc = cell.accuracy;
        const bg =
          acc === null ? "#f1f5f9" : acc >= 90 ? "#dcfce7" : acc >= 70 ? "#e0f2fe" : acc >= 40 ? "#ffedd5" : "#fee2e2";
        const border =
          acc === null ? "#cbd5e1" : acc >= 90 ? "#22c55e" : acc >= 70 ? "#0ea5e9" : acc >= 40 ? "#fb923c" : "#ef4444";

        return (
          <button
            key={cell.table_num}
            onClick={() => onClickTable(cell.table_num)}
            style={{
              padding: 12,
              borderRadius: 16,
              border: `2px solid ${border}`,
              background: bg,
              textAlign: "left",
              cursor: "pointer",
              minHeight: 86,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              × {cell.table_num}
            </div>
            <div style={{ marginTop: 6, color: "#475569", fontWeight: 800 }}>
              {acc === null ? "No data" : `${acc}%`}
            </div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
              {cell.correct}/{cell.total}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function badgePercent(percent) {
  const bg =
    percent >= 90 ? "#dcfce7" : percent >= 70 ? "#e0f2fe" : percent >= 40 ? "#ffedd5" : "#fee2e2";
  const border =
    percent >= 90 ? "#22c55e" : percent >= 70 ? "#0ea5e9" : percent >= 40 ? "#fb923c" : "#ef4444";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: 999,
        border: `2px solid ${border}`,
        background: bg,
        fontWeight: 900,
      }}
    >
      {percent}%
    </span>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle = {
  textAlign: "left",
  padding: "10px 10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
};

const tdStyle = {
  padding: "10px 10px",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
};

const labelStyle = { display: "block", fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 };
const inputSmall = { padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", fontWeight: 800 };
const primaryBtn = { padding: "12px 14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#0ea5e9,#22c55e)", color: "white", fontWeight: 900, cursor: "pointer" };
const linkStyle = { display: "inline-block", marginTop: 8, fontWeight: 900, color: "#0ea5e9", textDecoration: "none" };
