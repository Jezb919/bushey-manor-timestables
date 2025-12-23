import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Chart (client-side only)
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
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load classes");
        setClasses(j.classes || []);
        if (j.classes?.length) setClassId(j.classes[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Load class attainment
  useEffect(() => {
    if (!classId) return;

    setError("");
    fetch(`/api/teacher/attainment/class?class_id=${encodeURIComponent(classId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load class data");
        setCls(j.class);
        setSeries(j.series || []);
      })
      .catch((e) => setError(String(e)));
  }, [classId]);

  // Convert months to labels + build trend line
  const { labels, barValues, lineValues } = useMemo(() => {
    const keys = (series || []).map((s) => s.month);
    const lastKeys = keys.slice(Math.max(0, keys.length - 12));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const labels = lastKeys.map((k) => {
      const [y, m] = k.split("-");
      const mi = Number(m) - 1;
      return `${monthNames[mi]} ${y.slice(2)}`;
    });

    const map = new Map((series || []).map((s) => [s.month, s.score]));
    const barValues = lastKeys.map((k) => {
      const v = map.get(k);
      return typeof v === "number" ? v : null;
    });

    // 3-month moving average
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
          borderColor: "rgba(244, 114, 182, 1)", // pink/red
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

        {error ? <div style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div> : null}

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
                {c.class_label} {c.year ? `(Y${c.year})` : ""}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.7 }}>
            {cls ? (
              <>
                <b>{cls.class_label}</b> {cls.year ? `— Year ${cls.year}` : ""}
              </>
            ) : (
              "Loading…"
            )}
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
        </div>
      </div>
    </div>
  );
}
