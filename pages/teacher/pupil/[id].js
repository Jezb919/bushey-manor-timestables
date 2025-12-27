import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
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

if (typeof window !== "undefined") {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);
}

// ✅ Bright, vibrant palette (your 4 colours)
function colourForScore(score) {
  if (score === null || score === undefined) return "#e5e7eb"; // empty
  if (score === 100) return "#00ff88";       // light green
  if (score >= 90) return "#00c853";         // dark green
  if (score >= 70) return "#ff9800";         // orange
  return "#ff1744";                          // red
}

// text colour so it stays readable on bright backgrounds
function textColour(bg) {
  if (bg === "#ff1744" || bg === "#00c853") return "white";
  return "#0f172a";
}

export default function PupilDetailPage() {
  const router = useRouter();
  const pupil_id = router.query.id;

  const [data, setData] = useState(null);
  const [heat, setHeat] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    if (!pupil_id) return;
    setLoading(true);
    setErr("");

    try {
      // 1) main pupil detail
      const r = await fetch(`/api/teacher/pupil_detail?pupil_id=${encodeURIComponent(pupil_id)}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed to load pupil");
      setData(j);

      // 2) heatmap (last 12 attempts, tables 1-12 by default)
      const hr = await fetch(`/api/teacher/pupil_heatmap?pupil_id=${encodeURIComponent(pupil_id)}&limit=12&max_table=12`);
      const hj = await hr.json();
      if (!hj.ok) throw new Error(hj.error || "Failed to load heatmap");
      setHeat(hj);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pupil_id]);

  const chartData = useMemo(() => {
    const series = data?.series || [];
    const labels = series.map((x) => new Date(x.date).toLocaleDateString("en-GB"));
    const scores = series.map((x) => x.score);

    const target = data?.target ?? 90;
    const targetArr = scores.map(() => target);

    return {
      labels,
      datasets: [
        { label: "Score (%)", data: scores, tension: 0.35, fill: true },
        { label: `Target (${target}%)`, data: targetArr, tension: 0, borderDash: [8, 6], pointRadius: 0 },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      animation: { duration: 900 },
      plugins: { legend: { display: true } },
      scales: { y: { min: 0, max: 100, ticks: { stepSize: 10 } } },
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
              <span style={{ ...pill, background: colourForScore(latest), color: textColour(colourForScore(latest)) }}>
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
          </div>
        </div>

        {err && <div style={errorBox}>{err}</div>}

        <div style={grid}>
          {/* Progress chart */}
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

          {/* Attempts list */}
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Last 20 attempts</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
              Colour key: 100% light green • 90–99% dark green • 70–89% orange • &lt;70% red
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
                    <th style={thRight}>Q</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows || []).map((r) => {
                    const bg = colourForScore(r.score);
                    return (
                      <tr key={r.id} style={{ background: bg, color: textColour(bg) }}>
                        <td style={td}>{r.date ? new Date(r.date).toLocaleString("en-GB") : "—"}</td>
                        <td style={{ ...td, fontWeight: 900 }}>{r.score === null ? "—" : `${r.score}%`}</td>
                        <td style={tdMono}>{r.tables?.length ? r.tables.join(", ") : "—"}</td>
                        <td style={tdRight}>{r.num_questions ?? "—"}</td>
                      </tr>
                    );
                  })}

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

        {/* Heatmap */}
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Times Tables Heatmap</div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Rows = table • Columns = most recent attempts • Cells show success rate for that table
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              <b>Key:</b> 100% light green • 90–99% dark green • 70–89% orange • &lt;70% red
            </div>
          </div>

          {loading ? (
            <div style={{ marginTop: 12 }}>Loading…</div>
          ) : (
            <Heatmap heat={heat} />
          )}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ heat }) {
  const cols = heat?.columns || [];
  const rows = heat?.rows || [];
  const grid = heat?.grid || [];

  if (!cols.length) return <div style={{ marginTop: 12, opacity: 0.8 }}>No attempts yet — heatmap will appear after pupils complete tests.</div>;

  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <div style={{ minWidth: 900 }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${cols.length}, 1fr)`, gap: 6, marginBottom: 6 }}>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>Table</div>
          {cols.map((c) => (
            <div key={c.attempt_id} style={{ fontWeight: 900, fontSize: 12, opacity: 0.75, textAlign: "center" }}>
              {c.label}
            </div>
          ))}
        </div>

        {/* Body */}
        {rows.map((t, rIdx) => (
          <div
            key={t}
            style={{
              display: "grid",
              gridTemplateColumns: `80px repeat(${cols.length}, 1fr)`,
              gap: 6,
              marginBottom: 6,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 900 }}>{t}×</div>

            {cols.map((c, cIdx) => {
              const cell = grid?.[rIdx]?.[cIdx] || null;
              const pct = cell?.pct ?? null;

              const bg = colourForScore(pct);

              return (
                <div
                  key={c.attempt_id}
                  title={
                    cell
                      ? `${pct}% (${cell.correct}/${cell.total})`
                      : "No questions for this table in that attempt"
                  }
                  style={{
                    height: 46,
                    borderRadius: 10,
                    background: bg,
                    color: textColour(bg),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    border: "2px solid rgba(15, 23, 42, 0.12)",
                    boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
                    transform: "translateZ(0)",
                  }}
                >
                  {pct === null ? "" : `${pct}%`}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* styles */
const grid = { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginTop: 16 };
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
