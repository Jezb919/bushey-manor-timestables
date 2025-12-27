import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function scoreToColour(score) {
  if (score === null || score === undefined) return "#f3f4f6"; // grey
  if (score >= 100) return "#b7f7c7"; // light green
  if (score >= 90) return "#16a34a"; // green
  if (score >= 70) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

export default function PupilPage() {
  const router = useRouter();
  const { student_id } = router.query;

  const [me, setMe] = useState(null);
  const [pupil, setPupil] = useState(null);
  const [progress, setProgress] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [error, setError] = useState("");

  async function loadMe() {
    const r = await fetch("/api/teacher/me");
    const j = await r.json();
    if (!j.ok) {
      window.location.href = "/teacher/login";
      return;
    }
    setMe(j.user);
  }

  async function loadAll() {
    if (!student_id) return;

    setError("");

    // Progress (list / later we can convert to chart)
    const pr = await fetch(`/api/teacher/pupil_progress?student_id=${student_id}`);
    const pj = await pr.json();
    if (!pj.ok) {
      setError(pj.error || "Failed to load progress");
      return;
    }
    setPupil(pj.pupil || null);
    setProgress(pj.series || []);

    // Heatmap
    const hr = await fetch(`/api/teacher/pupil_heatmap?student_id=${student_id}`);
    const hj = await hr.json();
    if (!hj.ok) {
      setError(hj.error || "Failed to load heatmap");
      return;
    }
    setHeatmap(hj.heatmap || null);
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student_id]);

  const displayName = pupil
    ? `${pupil.first_name || ""} ${pupil.last_name || ""}`.trim() || pupil.username || "Pupil"
    : "Pupil";

  return (
    <div style={{ padding: 24 }}>
      {me && (
        <p style={{ opacity: 0.8 }}>
          Logged in as <b>{me.email}</b> ({me.role})
        </p>
      )}

      <p>
        <Link href="/teacher/class-overview">← Back to class overview</Link> •{" "}
        <Link href="/teacher">Back to dashboard</Link>
      </p>

      {error && (
        <div style={{ background: "#fee2e2", padding: 12, borderRadius: 10, marginTop: 12 }}>
          <b style={{ color: "#991b1b" }}>{error}</b>
        </div>
      )}

      <h1 style={{ marginTop: 12 }}>{displayName}</h1>

      {/* Progress */}
      <div style={{ background: "white", borderRadius: 18, padding: 18, marginTop: 18, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
        <h2 style={{ marginTop: 0 }}>Progress over time</h2>

        {progress.length === 0 ? (
          <p>No attempts yet.</p>
        ) : (
          <ul>
            {progress.map((x) => (
              <li key={x.attempt_id}>
                {new Date(x.created_at).toLocaleString("en-GB")} — <b>{x.score}%</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Heatmap */}
      <div style={{ background: "white", borderRadius: 18, padding: 18, marginTop: 18, boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
          <h2 style={{ marginTop: 0 }}>Times Tables Heatmap</h2>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            <b>Key</b>
            <div>100% light green • 90–99% green • 70–89% orange • &lt;70% red</div>
          </div>
        </div>

        <div style={{ opacity: 0.75, marginBottom: 10 }}>
          Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
        </div>

        {!heatmap ? (
          <p>No heatmap data yet (or it failed to load).</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 10 }}>
              <thead>
                <tr>
                  <th align="left">Table</th>
                  {heatmap.columns.map((c) => (
                    <th key={c} align="center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.table}>
                    <td style={{ fontWeight: 700 }}>{row.table}×</td>
                    {row.cells.map((cell, idx) => (
                      <td key={idx}>
                        <div
                          style={{
                            width: 110,
                            height: 44,
                            borderRadius: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            background: scoreToColour(cell.score),
                            color: cell.score !== null && cell.score !== undefined && cell.score < 70 ? "white" : "#111827",
                            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.06)",
                          }}
                          title={cell.score === null ? "No data" : `${cell.score}%`}
                        >
                          {cell.score === null ? "—" : `${cell.score}%`}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
