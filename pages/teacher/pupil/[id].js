import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function colourForPercent(p) {
  if (p === null || p === undefined) return "#EEF2F7"; // light grey
  if (p === 100) return "#BFF7C1"; // light green
  if (p >= 90) return "#2E9E4F"; // dark green
  if (p >= 70) return "#F6A03A"; // orange
  return "#FF3B5C"; // red
}

export default function PupilPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr("");

    fetch(`/api/teacher/pupil_detail?student_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setErr(j.error || "Failed to load pupil");
          setLoading(false);
          return;
        }
        setData(j);
        setLoading(false);
      })
      .catch(() => {
        setErr("Failed to load pupil");
        setLoading(false);
      });
  }, [id]);

  const pupilName = useMemo(() => {
    if (!data?.pupil) return "Pupil";
    const fn = data.pupil.first_name || "";
    const ln = data.pupil.last_name || data.pupil.surname || "";
    const full = `${fn} ${ln}`.trim();
    return full || "Pupil";
  }, [data]);

  const cols = data?.heatmap?.[0]?.cells?.length ? data.heatmap[0].cells : [];
  const colLabels = cols.map((c) =>
    new Date(c.date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })
  );

  return (
    <div style={{ padding: 30 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 8, color: "#444" }}>
          {data?.me?.email ? <>Logged in as <b>{data.me.email}</b> ({data.me.role})</> : null}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/teacher/class-overview">← Back to class overview</Link>
          <Link href="/teacher">Back to dashboard</Link>
        </div>
      </div>

      <h1 style={{ marginTop: 18 }}>{pupilName}</h1>

      {loading && <p>Loading…</p>}
      {err && (
        <div style={{ background: "#FDECEC", color: "#B00020", padding: 12, borderRadius: 10, marginTop: 12 }}>
          {err}
        </div>
      )}

      {!loading && !err && data && (
        <>
          {/* Progress over time */}
          <div
            style={{
              marginTop: 18,
              background: "white",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Progress over time</h2>
            {data.series?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.series.slice(-10).map((s, idx) => (
                  <li key={idx}>
                    {new Date(s.date).toLocaleString("en-GB")} — <b>{s.score}%</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No attempts yet.</p>
            )}
          </div>

          {/* Heatmap */}
          <div
            style={{
              marginTop: 18,
              background: "white",
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "baseline" }}>
              <div>
                <h2 style={{ margin: 0 }}>Times Tables Heatmap</h2>
                <div style={{ color: "#444", marginTop: 6 }}>
                  Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
                </div>
              </div>

              <div style={{ color: "#444", fontSize: 14 }}>
                Key: 100% light green • 90–99% green • 70–89% orange • &lt;70% red
              </div>
            </div>

            {!data.heatmap?.length ? (
              <p style={{ marginTop: 12 }}>No heatmap data yet (or it failed to load).</p>
            ) : (
              <div style={{ marginTop: 14, overflowX: "auto" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 8 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", paddingRight: 10 }}>Table</th>
                      {colLabels.map((lbl, i) => (
                        <th key={i} style={{ textAlign: "center", minWidth: 90 }}>
                          {lbl}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.heatmap.map((row) => (
                      <tr key={row.table}>
                        <td style={{ fontWeight: 700 }}>{row.table}×</td>
                        {row.cells.map((c) => {
                          const bg = colourForPercent(c.percent);
                          const text = c.percent === null ? "—" : `${c.percent}%`;
                          const fg = c.percent !== null && c.percent < 70 ? "white" : "#0B1020";
                          return (
                            <td
                              key={c.attempt_id}
                              style={{
                                background: bg,
                                color: fg,
                                borderRadius: 10,
                                textAlign: "center",
                                padding: "10px 12px",
                                fontWeight: 800,
                                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.06)",
                              }}
                              title={c.total ? `${c.percent}% (${c.total} questions)` : "No questions for this table"}
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
          </div>
        </>
      )}
    </div>
  );
}
