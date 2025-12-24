import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

function studentLabel(s) {
  return s.first_name || s.username || s.student_id || "Pupil";
}

export default function AttainmentIndividualClient() {
  const router = useRouter();

  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  // 1) Load students
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch("/api/teacher/students");
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load students");

        const list = j.students || [];
        setStudents(list);

        // ✅ Preselect from URL if provided
        const fromUrl = typeof router.query.student_id === "string" ? router.query.student_id : "";
        const found = fromUrl && list.find((s) => s.id === fromUrl);

        if (found) {
          setStudentId(found.id);
        } else if (list.length) {
          setStudentId(list[0].id);
        }
      } catch (e) {
        setError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // 2) When studentId changes, update URL (so refresh keeps the selection)
  useEffect(() => {
    if (!studentId) return;
    router.replace(
      {
        pathname: "/teacher/admin/attainment-individual",
        query: { student_id: studentId },
      },
      undefined,
      { shallow: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // 3) Load student attainment series
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        setError("");
        const r = await fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(studentId)}`);
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load student");

        setStudent(j.student || null);
        setSeries(j.series || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [studentId]);

  const chartData = useMemo(() => {
    const labels = (series || []).map((p) => new Date(p.date).toLocaleDateString("en-GB"));
    const values = (series || []).map((p) => p.score);

    return {
      labels,
      datasets: [
        {
          label: "Score (%)",
          data: values,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
        },
      ],
    };
  }, [series]);

  const options = useMemo(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: prefersReducedMotion ? false : { duration: 900, easing: "easeOutQuart" },
      plugins: {
        legend: { display: true },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "nearest", intersect: false },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
      },
    };
  }, []);

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Individual Attainment</h1>

        {error ? (
          <div style={{ color: "#b91c1c", fontWeight: 800, marginBottom: 10 }}>{error}</div>
        ) : null}

        <div
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900 }}>Pupil</div>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 260,
            }}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentLabel(s)} {s.class_label ? `(${s.class_label})` : ""}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
            {student ? (
              <>
                Selected: <b>{studentLabel(student)}</b> {student.class_label ? `(${student.class_label})` : ""}
              </>
            ) : (
              "Loading pupil..."
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
          <div style={{ height: 420 }}>
            <Line data={chartData} options={options} />
          </div>

          {!series.length ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No attempts found for this pupil yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
