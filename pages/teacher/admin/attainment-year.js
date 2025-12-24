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

export default function AttainmentYearPage() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState("");
  const [classes, setClasses] = useState([]);
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

  // Load dashboard data
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
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Year Group Attainment</h1>

        {error ? (
          <div style={{ color: "#b91c1c", marginBottom: 12, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

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

          <div style={{ marginLeft: "auto", opacity: 0.7 }}>
            <b>{classes.length}</b> classes found
          </div>
        </div>

        {/* Cards grid */}
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
                  backgroundColor: "rgba(46, 125, 50, 0.85)", // green
                },
                {
                  type: "line",
                  label: "Trend (3-month avg)",
                  data: lineValues,
                  borderWidth: 3,
                  tension: 0.35,
                  fill: false,
                  borderColor: "rgba(244, 114, 182, 1)", // pink line
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
