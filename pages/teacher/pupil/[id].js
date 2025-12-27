import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Line = dynamic(
  () => import("react-chartjs-2").then((m) => m.Line),
  { ssr: false }
);

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

if (typeof window !== "undefined") {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);
}

function colourFor(score) {
  if (score === null || score === undefined) return "#f1f5f9";
  if (score === 100) return "#dcfce7";
  if (score >= 90) return "#86efac";
  if (score >= 70) return "#fed7aa";
  return "#fecaca";
}

export default function PupilDetailPage() {
  const router = useRouter();
  const pupil_id = router.query.id;

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pupil_id) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/teacher/pupil_detail?pupil_id=${encodeURIComponent(pupil_id)}`);
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "Failed to load pupil");
        setData(j);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [pupil_id]);

  const chartData = useMemo(() => {
    const series = data?.series || [];
    const labels = series.map((x) => new Date(x.date).toLocaleDateString("en-GB"));
    const scores = series.map((x) => x.score);

    // Target line (same length)
    const target = (data?.target ?? 90);
    const targetArr = scores.map(() => target);

    return {
      labels,
      datasets: [
        {
          label: "Score (%)",
          data: scores,
          tension: 0.35,
          fill: true,
        },
        {
          label: `Target (${target}%)`,
          data: targetArr,
          tension: 0,
          borderDash: [8, 6],
          pointRadius: 0,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      animation: { duration: 900 },
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        y: { min: 0, max: 100, ticks: { stepSize: 10 } },
      },
    };
  }, []);

  const pupilName = data?.pupil?.name || "Pupil";
  const classLabel = data?.pupil?.class_label || "";
  const latest = data?.rows?.[0]?.score ?? null;

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ opacity: 0.7, fontWeight: 900 }}>{classLabel}</div>
            <h1 style={{ margin: 0, fontSize: 44, fontWeight: 900 }}>{pupilName}</h1>

            <div style={{ marginTop: 10 }}>
              <span style={{ ...pill, background: colourFor(latest) }}>
                Latest: {latest === null ? "—" : `${latest}%`}
              </span>
              <span style={{ ...pill, background: "#fff" }}>Target: 90%</span>
              <span style={{ ...pill, background: "#fff" }}>All attempts</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={btn} onClick={() => router.push("/teacher/class-overview")}>
              ← Back to class
            </button>
            <button
              style={btn}
              onClick={() => router.push(`/teacher/admin/attainment-individual?student_id=${encodeURIComponent(pupil_id)}`)}
            >
              Open graph page
            </button>
          </div>
        </div>

        {err && <div style={errorBox}>{err}</div>}

        <div style={grid}>
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Progress over time</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
              Line animates on load. Target shown at 90%.
            </div>
            {loading ? (
              <div>Loading…</div>
            ) : (
              <div style={{ background: "#fff", borderRadius: 14, padding: 10 }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Last 20 attempts</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
              Click an attempt later (next step) to drill into heatmaps etc.
            </div>

            {loading ? (
              <div>Loading…</div>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Score</th>
                    <th style={th}>Tables</th>
                    <th style={thRight}>Questions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows || []).map((r) => (
                    <tr key={r.id} style={{ background: colourFor(r.score) }}>
                      <td style={td}>{r.date ? new Date(r.date).toLocaleString("en-GB") : "—"}</td>
                      <td style={{ ...td, fontWeight: 900 }}>{r.score === null ? "—" : `${r.score}%`}</td>
                      <td style={tdMono}>{r.tables?.length ? r.tables.join(", ") : "—"}</td>
                      <td style={tdRight}>{r.num_questions ?? "—"}</td>
                    </tr>
                  ))}

                  {!data?.rows?.length && (
                    <tr>
                      <td style={td} colSpan={4}>No attempts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
          Next we’ll add: heatmap + “areas of weakness” + attempt click-through.
        </div>
      </div>
    </div>
  );
}

/* styles */
const grid = { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginTop: 16 };
const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
};
const btn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
const pill = { display: "inline-block", padding: "8px 10px", borderRadius: 999, marginRight: 8, fontWeight: 900 };
const errorBox = { marginTop: 14, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 900 };

const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.12)", opacity: 0.7, fontSize: 12 };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
const tdMono = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const tdRight = { ...td, textAlign: "right", fontWeight: 900 };
