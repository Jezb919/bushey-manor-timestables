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
  TimeScale,
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function AttainmentIndividual() {
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [series, setSeries] = useState([]);
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");

  // Load students teacher is allowed to see
  useEffect(() => {
    (async () => {
      setError("");
      const r = await fetch("/api/teacher/students");
      const j = await r.json();
      if (!j.ok) return setError(j.error || "Failed to load students");
      setStudents(j.students || []);
      if ((j.students || []).length && !studentId) setStudentId(j.students[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected student's series
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      setError("");
      const r = await fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(studentId)}`);
      const j = await r.json();
      if (!j.ok) return setError(j.error || "Failed to load attainment");
      setStudent(j.student);
      setSeries(j.series || []);
    })();
  }, [studentId]);

  const labels = useMemo(
    () => series.map((p) => new Date(p.date).toLocaleDateString("en-GB")),
    [series]
  );
  const scores = useMemo(() => series.map((p) => p.score), [series]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Score (%)",
          data: scores,
          // leave default colours (you asked not to specify)
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    }),
    [labels, scores]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      animation: prefersReducedMotion
        ? false
        : {
            duration: 1000,
            easing: "easeOutQuart",
          },
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 10 } },
      },
    }),
    [prefersReducedMotion]
  );

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Individual Progress</h1>

      {error ? (
        <div style={{ marginTop: 12, color: "crimson" }}>{String(error)}</div>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontWeight: 600 }}>Pupil</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id} {s.class_label ? `(${s.class_label})` : ""}
            </option>
          ))}
        </select>
      </div>

      {student ? (
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          Showing: <b>{student.name}</b> {student.class_label ? `— ${student.class_label}` : ""}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {/* key forces re-animation when pupil changes */}
        <Line key={studentId} data={data} options={options} />
      </div>
    </div>
  );
}
