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
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function AttainmentIndividual() {
  const [students, setStudents] = useState([]);
  const [studentCode, setStudentCode] = useState(""); // <-- IMPORTANT: this is students.student_id (NOT uuid)
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  // Load students teacher/admin is allowed to see
  useEffect(() => {
    (async () => {
      setError("");
      const r = await fetch("/api/teacher/students");
      const j = await r.json();
      if (!j.ok) return setError(j.error || "Failed to load students");
      setStudents(j.students || []);

      // pick first student's student_id
      if ((j.students || []).length) {
        const first = j.students[0];
        setStudentCode(first.student_id || "");
      }
    })();
  }, []);

  // Load selected student's series
  useEffect(() => {
    if (!studentCode) return;
    (async () => {
      setError("");
      const r = await fetch(
        `/api/teacher/attainment/student?student_id=${encodeURIComponent(studentCode)}`
      );
      const j = await r.json();
      if (!j.ok) return setError(j.error || "Failed to load student/attainment");
      setStudent(j.student);
      setSeries(j.series || []);
    })();
  }, [studentCode]);

  const labels = useMemo(
    () => series.map((p) => new Date(p.date).toLocaleDateString("en-GB")),
    [series]
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Score (%)",
          data: series.map((p) => p.score),
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    }),
    [labels, series]
  );

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const options = useMemo(
    () => ({
      responsive: true,
      animation: prefersReducedMotion
        ? false
        : {
            duration: 1000,
            easing: "easeOutQuart",
          },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 10 } },
      },
    }),
    [prefersReducedMotion]
  );

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Individual Attainment</h1>

      {error ? <div style={{ marginTop: 10, color: "crimson" }}>{String(error)}</div> : null}

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontWeight: 600 }}>Pupil</label>

        <select value={studentCode} onChange={(e) => setStudentCode(e.target.value)}>
          {students.map((s) => (
            <option key={s.student_id || s.id} value={s.student_id}>
              {s.name || s.student_id} {s.class_label ? `(${s.class_label})` : ""}
            </option>
          ))}
        </select>
      </div>

      {student ? (
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Showing: <b>{student.name}</b> {student.class_label ? `— ${student.class_label}` : ""}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Line key={studentCode} data={data} options={options} />
      </div>

      {studentCode && series.length === 0 && !error ? (
        <div style={{ marginTop: 10, opacity: 0.8 }}>
          No attempts found for this pupil yet.
        </div>
      ) : null}
    </div>
  );
}
