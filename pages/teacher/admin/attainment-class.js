import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Chart (client-only)
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), {
  ssr: false,
});

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
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  // Load classes
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

  // Build labels + bars + trend
  const { labels, barValues, lineValues } = useMemo(() => {
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const keys = (series || []).map((s) => s.month);
    const lastKeys = keys.slice(Math.max(0, keys.length - 12));

    const labels = lastKeys.map((k) => {
      const [y, m] = k.split("-");
      return `${monthNames[Number(m) - 1]} ${y.slice(2)}`;
    });

    const map = new Map(series.map((s) => [s.month, s.score]));
    const barValues = lastKeys.map((k) => map.get(k));

    const lineValues = barValues.map((_, i) => {
      const vals = barValues.slice(Math.max(0, i - 2), i + 1).filter(Number.isFinite);
      if (!vals.length) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });

    return { labels, barValues, lineValues };
  }, [series]);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: "bar",
          label: "Class Average",
          data: barValues,
          backgroundColor: "rgba(46,125,50,0.85)",
          borderRadius: 8,
        },
        {
          type: "line",
          label: "Trend",
          data: lineValues,
          borderColor: "rgba(244,114,182,1)",
          borderWidth: 3,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    }),
    [labels, barValues, lineValues]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100 },
    },
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Class Attainment</h1>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <select value={classId} onChange={(e) => setClassId(e.target.value)}>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.class_label}
          </option>
        ))}
      </select>

      <div style={{ height: 380, marginTop: 20 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
