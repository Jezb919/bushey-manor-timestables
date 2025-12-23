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

export default function AttainmentIndividualClient() {
  const [students, setStudents] = useState([]);
  const [studentUuid, setStudentUuid] = useState("");
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/students")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load students");
        setStudents(j.students || []);
        if (j.students?.length) setStudentUuid(j.students[0].id);
      });
  }, []);

  useEffect(() => {
    if (!studentUuid) return;
    fetch(`/api/teacher/attainment/student?student_id=${studentUuid}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setError(j.error || "Failed to load student");
        setStudent(j.student);
        setSeries(j.series || []);
      });
  }, [studentUuid]);

  const data = {
    labels: series.map((s) => new Date(s.date).toLocaleDateString("en-GB")),
    datasets: [
      {
        label: "Score (%)",
        data: series.map((s) => s.score),
        tension: 0.3,
      },
    ],
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Individual Attainment</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <select value={studentUuid} onChange={(e) => setStudentUuid(e.target.value)}>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 20 }}>
        <Line data={data} />
      </div>
    </div>
  );
}
