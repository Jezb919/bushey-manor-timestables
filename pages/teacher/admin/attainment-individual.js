import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// ✅ Use Bar chart (we can still overlay a line dataset on top)
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

export default function AttainmentIndividualPage() {
  const [students, setStudents] = useState([]);
  const [studentUuid, setStudentUuid] = useState("");
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]); // {date, score}
  const [error, setError] = useState("");

  // Load students
  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load students");
        setStudents(j.students || []);
        if (j.students?.length) setStudentUuid(j.students[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Load selected student's attempts series
  useEffect(() => {
    if (!studentUuid) return;

    setError("");
    fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(studentUuid)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load student");
        setStudent(j.student);
        setSeries(j.series || []);
      })
      .catch((e) => setError(String(e)));
  }, [studentUuid]);

  // --- Turn attempts into MONTHLY bars (like your example: Jan..Dec)
  // Bars = monthly average score
  // Line = trend (3-month moving average)
  const { labels, barValues, lineValues } = useMemo(() => {
    // bucket by YYYY-MM
    const bucket = new Map(); // key -> {sum,count}
    for (const p of series) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = bucket.get(key) || { sum: 0, count: 0 };
      cur.sum += p.score;
      cur.count += 1;
      bucket.set(key, cur);
    }

    // sort keys
    const keys = [...bucket.keys()].sort((a, b) => a.localeCompare(b));

    // If you have loads of months, keep last 12 (looks like the example)
    const lastKeys = keys.slice(Math.max(0, keys.length - 12));

    const labels = lastKeys.map((k) => {
      const [y, m] = k.split("-");
      const monthIndex = Number(m) - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[monthIndex]} ${y.slice(2)}`; // e.g. "Jan 25"
    });

    const barValues = lastKeys.map((k) => {
      const v = bucket.get(k);
      return v && v.count ? Math.round(v.sum / v.count) : null;
    });

    // 3-month moving average line
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
        // ✅ Green bars (current performance)
        {
          type: "bar",
          label: "Average Score (Monthly)",
          data: barValues,
          borderWidth: 0,
          borderRadius: 8,
          backgroundColor: "rgba(46, 125, 50, 0.85)", // green
        },

        // ✅ Pink/red line overlay (trend)
        {
          type: "line",
          label: "Trend (3-month avg)",
          data: lineValues,
          borderWidth: 3,
          tension: 0.35,
          fill: false,
          borderColor: "rgba(244, 114, 182, 1)", // pink/red line
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
        legend: {
          display: true,
          labels: { boxWidth: 12, boxHeight: 12, padding: 14 },
        },
        tooltip: {
          intersect: false,
          mode: "index",
          padding: 12,
          displayColors: true,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
          },
        },
      },
      interaction: { intersect: false, mode: "nearest" },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 10, callback: (v) => `${v}%` },
          grid: { drawBorder: false },
        },
      },
    };
  }, []);

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>
          Individual Attainment
        </h1>

        {error ? (
          <div style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</div>
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
          <div style={{ fontWeight: 800 }}>Pupil</div>
          <select
            value={studentUuid}
            onChange={(e) => setStudentUuid(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 280,
            }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.class_label ? `(${s.class_label})` : ""}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.7 }}>
            {student ? (
              <>
                <b>{student.name}</b> {student.class_label ? `— ${student.class_label}` : ""}
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
          <div style={{ fontWeight: 900, fontSize: 16 }}>Monthly Progress (Bars + Trend Line)</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
            Bars = average score per month. Line = 3-month trend.
          </div>

          <div style={{ height: 380, marginTop: 10 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>

          {!error && labels.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No attempts found for this pupil yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
