import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
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

export default function AttainmentIndividualClient() {
  const [students, setStudents] = useState([]);
  const [studentUuid, setStudentUuid] = useState("");
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  // Load students list
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

  // Load selected student series
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

  const chartData = useMemo(() => {
    return {
      labels: series.map((s) => new Date(s.date).toLocaleDateString("en-GB")),
      datasets: [
        {
          label: "Score (%)",
          data: series.map((s) => s.score),

          // Stylish + readable
          borderWidth: 4,
          pointRadius: 3,
          pointHoverRadius: 7,
          tension: 0.35,
          fill: true,

          // Colours (school-friendly)
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.18)",
          pointBackgroundColor: "rgba(59, 130, 246, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [series]);

  const chartOptions = useMemo(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return {
      responsive: true,
      maintainAspectRatio: false,

      animation: prefersReducedMotion
        ? false
        : {
            duration: 900,
            easing: "easeOutQuart",
          },

      interaction: {
        intersect: false,
        mode: "nearest",
      },

      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 16,
          },
        },
        tooltip: {
          enabled: true,
          intersect: false,
          mode: "index",
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Score: ${ctx.parsed.y}%`,
          },
        },
      },

      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 10,
            callback: (v) => `${v}%`,
          },
          grid: {
            drawBorder: false,
          },
        },
      },
    };
  }, []);

  return (
    <div style={{ padding: 20, background: "#f7f7fb", minHeight: "100vh" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>Individual Attainment</h1>
        <div style={{ opacity: 0.75, marginBottom: 14 }}>
          Select a pupil to see progress over time (animated).
        </div>

        {error ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.20)",
              color: "#b91c1c",
              marginBottom: 12,
            }}
          >
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

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {[
            ["Latest", latest != null ? `${latest}%` : "—"],
            ["Average", avg != null ? `${avg}%` : "—"],
            ["Best", best != null ? `${best}%` : "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: "10px 12px",
                borderRadius: 16,
                background: "#fff",
                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.06)",
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.65 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Chart card */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Progress Over Time</div>
            <div style={{ opacity: 0.65, fontSize: 12 }}>
              {series.length ? `${series.length} attempts` : "No data yet"}
            </div>
          </div>

          <div style={{ height: 380, marginTop: 10 }}>
            <Line key={studentUuid} data={chartData} options={chartOptions} />
          </div>

          {!error && series.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No attempts found for this pupil yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
