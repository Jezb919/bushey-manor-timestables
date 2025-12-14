import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const CLASSES = ["M3","B3","M4","B4","M5","B5","M6","B6"];

export default function TeacherDashboard() {
  const [classLabel, setClassLabel] = useState("M4");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/teacher/overview?class_label=${classLabel}&days=${days}`);
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classLabel, days]);

  const leaderboard = data?.leaderboard || [];
  const classTrend = data?.classTrend || [];
  const tableHeat = data?.tableHeat || [];

  const chartData = useMemo(() => {
    return {
      labels: classTrend.map((x) => x.day),
      datasets: [
        {
          label: "Class average %",
          data: classTrend.map((x) => x.avg_percent),
        },
      ],
    };
  }, [classTrend]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        y: { min: 0, max: 100 },
      },
    };
  }, []);

  return (
    <div style={outerStyle}>
      <div style={pageStyle}>
        <Header />

        <div style={controlsRow}>
          <div style={controlBox}>
            <div style={label}>Class</div>
            <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)} style={select}>
              {CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={controlBox}>
            <div style={label}>Timeframe</div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={select}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ color: "#9ca3af", fontSize: "0.95rem" }}>
            {loading ? "Loading…" : data?.ok ? "Updated" : "—"}
          </div>
        </div>

        {/* Leaderboard */}
        <div style={card}>
          <h2 style={h2}>Class leaderboard</h2>
          <p style={p}>Latest attempt per pupil (with change vs their previous attempt in the selected timeframe).</p>

          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Student</th>
                  <th style={th}>Score</th>
                  <th style={th}>%</th>
                  <th style={th}>Change</th>
                  <th style={th}>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => {
                  const band = performanceBand(r.percent);
                  return (
                    <tr key={r.student_id} style={tr}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{r.student}</td>
                      <td style={td}>{r.score ?? "—"} / {r.total ?? "—"}</td>
                      <td style={{ ...td, fontWeight: 800, color: band.text }}>{r.percent ?? "—"}</td>
                      <td style={{ ...td, color: deltaColor(r.delta_percent) }}>
                        {r.delta_percent === null ? "—" : `${r.delta_percent > 0 ? "+" : ""}${r.delta_percent}%`}
                      </td>
                      <td style={td}>{r.attempts_in_range}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {legendPill("100%", "#16a34a")}
            {legendPill("80–99%", "#2563eb")}
            {legendPill("60–79%", "#f59e0b")}
            {legendPill("40–59%", "#fb923c")}
            {legendPill("<40%", "#ef4444")}
          </div>
        </div>

        {/* Trend */}
        <div style={card}>
          <h2 style={h2}>Class progress over time</h2>
          <p style={p}>Daily average % across all attempts in the selected timeframe.</p>
          {classTrend.length ? <Line data={chartData} options={chartOptions} /> : <div style={empty}>No attempts yet for this timeframe.</div>}
        </div>

        {/* Heatmap */}
        <div style={card}>
          <h2 style={h2}>Times table heatmap</h2>
          <p style={p}>Accuracy by table (1–19) for the selected class and timeframe.</p>

          <div style={heatGrid}>
            {tableHeat.map((t) => {
              const bg = heatColor(t.accuracy);
              return (
                <div key={t.table_num} style={{ ...heatCell, background: bg }}>
                  <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>{t.table_num}</div>
                  <div style={{ fontSize: "0.9rem" }}>
                    {t.accuracy === null ? "—" : `${t.accuracy}%`}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                    {t.total ? `${t.correct}/${t.total}` : "0 tries"}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "0.75rem", color: "#9ca3af", fontSize: "0.9rem" }}>
            Tip: the more tests you run, the more reliable the heatmap becomes.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function performanceBand(percent) {
  if (percent === null || percent === undefined) return { text: "#e5e7eb" };
  if (percent === 100) return { text: "#16a34a" };     // green
  if (percent >= 80) return { text: "#2563eb" };       // blue
  if (percent >= 60) return { text: "#f59e0b" };       // amber
  if (percent >= 40) return { text: "#fb923c" };       // orange
  return { text: "#ef4444" };                          // red
}

function deltaColor(delta) {
  if (delta === null || delta === undefined) return "#9ca3af";
  if (delta > 0) return "#22c55e";
  if (delta < 0) return "#ef4444";
  return "#e5e7eb";
}

// Heat colour from accuracy
function heatColor(acc) {
  if (acc === null || acc === undefined) return "rgba(148,163,184,0.15)";
  if (acc >= 90) return "rgba(34,197,94,0.35)";
  if (acc >= 75) return "rgba(37,99,235,0.30)";
  if (acc >= 60) return "rgba(245,158,11,0.30)";
  if (acc >= 40) return "rgba(251,146,60,0.30)";
  return "rgba(239,68,68,0.32)";
}

function legendPill(label, color) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(148,163,184,0.25)",
      color: "#e5e7eb",
      fontSize: "0.9rem",
      fontWeight: 700,
    }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </div>
  );
}

function Header() {
  return (
    <div style={header}>
      <div style={badge}>BM</div>
      <div>
        <div style={smallCaps}>Teacher Dashboard</div>
        <div style={title}>Times Tables Analytics</div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const outerStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
  padding: "1.5rem",
  color: "white",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const pageStyle = {
  maxWidth: 1100,
  margin: "0 auto",
};

const header = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  marginBottom: "1.25rem",
};

const badge = {
  width: 54,
  height: 54,
  borderRadius: "50%",
  background: "white",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  color: "#0f172a",
};

const smallCaps = {
  fontSize: "0.78rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const title = {
  fontSize: "1.55rem",
  fontWeight: 900,
  color: "#facc15",
};

const controlsRow = {
  display: "flex",
  gap: "1rem",
  flexWrap: "wrap",
  alignItems: "flex-end",
  marginBottom: "1rem",
};

const controlBox = { minWidth: 220 };

const label = {
  color: "#9ca3af",
  fontSize: "0.85rem",
  marginBottom: "0.35rem",
};

const select = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.35)",
  outline: "none",
};

const card = {
  background: "rgba(3,7,18,0.92)",
  borderRadius: 18,
  padding: "1.2rem 1.25rem",
  border: "1px solid rgba(148,163,184,0.25)",
  boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
  marginBottom: "1rem",
};

const h2 = { margin: "0 0 0.4rem 0" };
const p = { margin: "0 0 0.9rem 0", color: "#d1d5db" };

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 720,
};

const th = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  color: "#9ca3af",
  fontSize: "0.9rem",
};

const tr = {};
const td = {
  padding: "10px 8px",
  borderBottom: "1px solid rgba(148,163,184,0.12)",
  color: "#e5e7eb",
};

const empty = { color: "#9ca3af", padding: "0.5rem 0" };

const heatGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(10, minmax(70px, 1fr))",
  gap: "10px",
};

const heatCell = {
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.25)",
  padding: "10px 10px",
  textAlign: "center",
};
