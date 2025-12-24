import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Chart (client-only)
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

export default function AttainmentClassPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [cls, setCls] = useState(null);
  const [series, setSeries] = useState([]); // [{month, score}]
  const [error, setError] = useState("");

  // Load allowed classes
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch("/api/teacher/classes");
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load classes");
        setClasses(j.classes || []);
        if (j.classes?.length) setClassId(j.classes[0].id);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // Load class attainment
  useEffect(() => {
    if (!classId) return;

    (async () => {
      try {
        setError("");
        const r = await fetch(`/api/teacher/attainment/class?class_id=${encodeURIComponent(classId)}`);
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load class attainment");
        setCls(j.class);
        setSeries(j.series || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [classId]);

  const { labels, barValues, lineValues } = useMemo(() => {
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // sort months to be safe
    const sorted = [...(series || [])].sort((a, b) => String(a.month).localeCompare(String(b.month)));

    // keep last 12 months (like the individual chart)
    const last = sorted.slice(Math.max(0, sorted.length - 12));

    const labels = last.map((s) => {
      const [y, m] = String(s.month).split("-");
      const mi = Number(m) - 1;
      return `${monthNames[mi]} ${y.slice(2)}`;
    });

    const barValues = last.map((s) => (typeof s.score === "number" ? s.score : null));

    // 3-month moving average (trend line)
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
  }, [series]);

  const chartData = useMemo(() => {
    return {
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
  }, [labels, barValues, lineValues]);

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
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Class Attainment</h1>

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
          <div style={{ fontWeight: 800 }}>Class</div>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 240,
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_label}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.7 }}>
            {cls ? <><b>{cls.class_label}</b></> : "Loading…"}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Monthly Class Average (Bars + Trend)</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
            Bars = average score per month. Line = 3-month trend.
          </div>

          <div style={{ height: 380, marginTop: 10 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>

          {!error && labels.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No attempts found for this class yet.
            </div>
          ) : null}

          {!error && labels.length === 1 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              Only one month of data so far — once pupils complete more tests across months, the bars and trend line will grow.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
