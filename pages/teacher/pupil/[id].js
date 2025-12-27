import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function colourForPct(pct) {
  if (pct === null || pct === undefined) return "#e9edf3";
  if (pct === 100) return "#bff7c7"; // light green
  if (pct >= 90) return "#2ecc71"; // green
  if (pct >= 70) return "#ffb020"; // orange
  return "#ff3b30"; // red
}

export default function PupilDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [err, setErr] = useState("");
  const [student, setStudent] = useState(null);
  const [heatmap, setHeatmap] = useState(null);

  useEffect(() => {
    if (!id) return;

    setErr("");
    setStudent(null);
    setHeatmap(null);

    // Heatmap
    fetch(`/api/teacher/pupil_heatmap?student_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Failed to load heatmap");
          return;
        }
        setStudent(j.student);
        setHeatmap(j);
      })
      .catch(() => setErr("Failed to load"));
  }, [id]);

  const columns = useMemo(() => {
    if (!heatmap?.attempts?.length) return [];
    return heatmap.attempts.map((a) =>
      new Date(a.date).toLocaleDateString("en-GB")
    );
  }, [heatmap]);

  return (
    <div style={{ padding: 30 }}>
      <p style={{ marginBottom: 10 }}>
        <Link href="/teacher/class-overview">← Back to class overview</Link> •{" "}
        <Link href="/teacher">Back to dashboard</Link>
      </p>

      <h1>Pupil</h1>

      {err && (
        <div
          style={{
            background: "#ffe5e5",
            border: "1px solid #ffb3b3",
            padding: 12,
            borderRadius: 10,
            marginBottom: 15,
            color: "#b00020",
          }}
        >
          {err}
        </div>
      )}

      {student && (
        <h2 style={{ marginTop: 10, marginBottom: 20 }}>
          {student.name || "(no name)"}
        </h2>
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Times Tables Heatmap</h2>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
        </p>

        {!heatmap ? (
          <p>Loading…</p>
        ) : heatmap.attempts.length === 0 ? (
          <p>No heatmap data yet (no attempts yet).</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 8,
                minWidth: 700,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingRight: 10 }}>Table</th>
                  {columns.map((c, idx) => (
                    <th key={idx} style={{ fontSize: 12, opacity: 0.8 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.grid.map((row) => (
                  <tr key={row.table}>
                    <td style={{ fontWeight: 700 }}>{row.table}×</td>
                    {row.cells.map((cell, idx) => {
                      const pct = cell ? cell.pct : null;
                      const bg = colourForPct(pct);
                      const text =
                        pct === null ? "" : `${pct}%`;
                      return (
                        <td
                          key={idx}
                          title={
                            cell
                              ? `${pct}% (${cell.correct}/${cell.total})`
                              : "No questions for this table"
                          }
                          style={{
                            width: 70,
                            height: 40,
                            background: bg,
                            borderRadius: 10,
                            textAlign: "center",
                            fontWeight: 800,
                            color: pct !== null && pct < 70 ? "#fff" : "#111",
                            boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.06)",
                          }}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          Key: 100% light green • 90–99% green • 70–89% orange • &lt;70% red
        </div>
      </div>
    </div>
  );
}
