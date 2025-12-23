import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Load chart only in browser (prevents build crash)
const Line = dynamic(
  () => import("react-chartjs-2").then((m) => m.Line),
  { ssr: false }
);

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

export default function AttainmentIndividualPage() {
  const [students, setStudents] = useState([]);
  const [studentUuid, setStudentUuid] = useState("");
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
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

  // Load selected student data
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

  const latest = series.length ? series[series.length - 1].score : null;
  const best = series.length ? Math.max(...series.map((s) => s.score)) : null;
  const avg = series.length
    ? Math.round(series.reduce((sum, s) => sum + s.score, 0) / series.length)
    : null;

  const chartData = useMemo(
    () => ({
      labels: series.map((s) => new Date(s.date).toLocaleDateString("en-GB")),
      datasets: [
        {
          label: "Score (%)",
          data: series.map((s) => s.score),
          borderWidth: 4,
          pointRadius: 3,
          pointHoverRadius: 7,
          tension: 0.35,
          fill: true,
          borderColor: "rgba(59,130,246,1)",
          backgroundColor: "rgba(59,130,246,0.18)",
          pointBackgroundColor: "rgba(59,130,246,1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    }),
    [series]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: "easeOutQuart" },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => `Score: ${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      y: { min: 0, max: 100 },
    },
  };

  return (
    <div style={{ padding: 20, background: "#f7f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Individual Attainment</h1>

        {error && (
          <div style={{ color: "#b91c1c", marginTop: 10 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <select
            value={studentUuid}
            onChange={(e) => setStudentUuid(e.target.value)}
            style={{ padding: 10, borderRadius: 10, minWidth: 280 }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.class_label ? `(${s.class_label})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {[
            ["Latest", latest],
            ["Average", avg],
            ["Best", best],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: 12,
                borderRadius: 14,
                background: "#fff",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {value != null ? `${value}%` : "—"}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            height: 380,
          }}
        >
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
