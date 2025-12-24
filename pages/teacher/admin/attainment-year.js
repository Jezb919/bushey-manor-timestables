import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });

import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

function buildLabelsAndTrend(series) {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sorted = [...(series || [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const last = sorted.slice(Math.max(0, sorted.length - 12));

  const labels = last.map((s) => {
    const [y, m] = String(s.month).split("-");
    return `${monthNames[Number(m) - 1]} ${y.slice(2)}`;
  });

  const barValues = last.map((s) => (typeof s.score === "number" ? s.score : null));

  const lineValues = barValues.map((_, i) => {
    const vals = [];
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      const n = barValues[j];
      if (typeof n === "number") vals.push(n);
    }
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  return { labels, barValues, lineValues };
}

function MetricPill({ label, value }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
        fontSize: 12,
        opacity: 0.85,
      }}
    >
      <b>{label}:</b> {value}
    </div>
  );
}

// ✅ Bulletproof: convert score to Number first
function scoreColour(score) {
  const s = Number(score);

  // 100% = light green
  if (s === 100) {
    return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", text: "#166534" };
  }
  // 90–99 = dark green
  if (s >= 90 && s <= 99) {
    return { bg: "rgba(21,128,61,0.15)", border: "rgba(21,128,61,0.4)", text: "#14532d" };
  }
  // 70–89 = orange
  if (s >= 70 && s <= 89) {
    return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", text: "#92400e" };
  }
  // below 70 = red
  return { bg: "rgba(185,28,28,0.15)", border: "rgba(185,28,28,0.4)", text: "#7f1d1d" };
}

export default function AttainmentYearPage() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [classes, setClasses] = useState([]);
  const [windowDays, setWindowDays] = useState(30);

  const [topImprovers, setTopImprovers] = useState([]);
  const [concerns, setConcerns] = useState([]);

  const [error, setError] = useState("");

  // Load available years
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch("/api/teacher/year-groups");
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load year groups");
        setYears(j.years || []);
        if ((j.years || []).length) setYear(String(j.years[0]));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Load charts data
  useEffect(() => {
    if (!year) return;
    (async () => {
      try {
        setError("");
        const r = await fetch(`/api/teacher/attainment/year?year=${encodeURIComponent(year)}`);
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load year dashboard");
        setClasses(j.classes || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [year]);

  // Load insights
  useEffect(() => {
    if (!year) return;
    (async () => {
      try {
        setError("");
        const r = await fetch(
          `/api/teacher/attainment/insights?year=${encodeURIComponent(year)}&window=${encodeURIComponent(windowDays)}`
        );
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load insights");
        setTopImprovers(j.topImprovers || []);
        setConcerns(j.concerns || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [year, windowDays]);

  const chartOptions = useMemo(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, boxHeight: 12, padding: 14 } },
        tooltip: {
          intersect: false,
          mode: "index",
          padding: 12,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` },
        },
      },
      interaction: { intersect: false, mode: "nearest" },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 100, ticks: { stepSize: 10, callback: (v) => `${v}%` } },
      },
    };
  }, []);

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Year Group Attainment</h1>

        {error ? (
          <div style={{ color: "#b91c1c", marginBottom: 12, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 14,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 800 }}>Year</div>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 160,
            }}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                Year {y}
              </option>
            ))}
          </select>

          <div style={{ fontWeight: 800, marginLeft: 8 }}>Window</div>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 160,
            }}
          >
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <MetricPill label="Classes" value={classes.length} />
            <MetricPill label="Top Improvers" value={topImprovers.length} />
            <MetricPill label="Concerns" value={concerns.length} />
          </div>
        </div>

        {/* Insights row */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 14,
          }}
        >
          {/* Top Improvers */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: "#fff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Top Improvers</div>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
              Improvement = recent average − previous window average (needs 2+ attempts in both windows).
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {topImprovers.length ? topImprovers.map((r, idx) => (
                <div
                  key={r.student_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "rgba(46,125,50,0.06)",
                    border: "1px solid rgba(46,125,50,0.15)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {idx + 1}. {r.name} <span style={{ opacity: 0.6 }}>({r.class_label})</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      Prev: {r.prevAvg}% ({r.prevCount}) → Recent: {r.recentAvg}% ({r.recentCount})
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: "rgba(46,125,50,1)" }}>
                      +{r.delta}%
                    </div>
                    <a href="/teacher/admin/attainment-individual" style={{ fontSize: 12, opacity: 0.75 }}>
                      Open individual
                    </a>
                  </div>
                </div>
              )) : (
                <div style={{ opacity: 0.75, marginTop: 8 }}>
                  Not enough data yet to calculate improvers (needs attempts in both windows).
                </div>
              )}
            </div>
          </div>

          {/* Concerns */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: "#fff",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Concern List (70% or below)</div>
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
              Colour key: 100% light green • 90–99% dark green • 70–89% orange • &lt;70% red
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {concerns.length ? concerns.map((r, idx) => {
                const colours = scoreColour(r.recentAvg);

                return (
                  <div
                    key={r.student_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: colours.bg,
                      border: `1px solid ${colours.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {idx + 1}. {r.name} <span style={{ opacity: 0.6 }}>({r.class_label})</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Recent: {r.recentAvg}% ({r.recentCount})
                        {r.prevAvg != null ? ` • Prev: ${r.prevAvg}% (${r.prevCount})` : ""}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: colours.text }}>
                        {r.recentAvg}%
                      </div>
                      <a href="/teacher/admin/attainment-individual" style={{ fontSize: 12, opacity: 0.75 }}>
                        Open individual
                      </a>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ opacity: 0.75, marginTop: 8 }}>
                  No pupils are at 70% or below in the selected window (or not enough attempts yet).
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cards grid: class charts */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 14,
          }}
        >
          {classes.map((c) => {
            const { labels, barValues, lineValues } = buildLabelsAndTrend(c.series || []);

            const data = {
              labels,
              datasets: [
                {
                  type: "bar",
                  label: "Class Average (Monthly)",
                  data: barValues,
                  borderWidth: 0,
                  borderRadius: 8,
                  backgroundColor: "rgba(46, 125, 50, 0.85)",
                },
                {
                  type: "line",
                  label: "Trend (3-month avg)",
                  data: lineValues,
                  borderWidth: 3,
                  tension: 0.35,
                  fill: false,
                  borderColor: "rgba(244, 114, 182, 1)",
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  pointBackgroundColor: "rgba(244, 114, 182, 1)",
                  pointBorderColor: "#fff",
                  pointBorderWidth: 2,
                },
              ],
            };

            const latest = (c.series || []).length ? c.series[c.series.length - 1].score : null;

            return (
              <div
                key={c.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "#fff",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {c.class_label} <span style={{ opacity: 0.5 }}>— Year {c.year_group}</span>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    Latest: <b>{typeof latest === "number" ? `${latest}%` : "—"}</b>
                  </div>
                </div>

                <div style={{ height: 280, marginTop: 10 }}>
                  <Bar data={data} options={chartOptions} />
                </div>

                {labels.length === 0 ? (
                  <div style={{ marginTop: 8, opacity: 0.75 }}>No attempts found for this class yet.</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
