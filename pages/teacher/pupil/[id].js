import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

function scoreColor(score) {
  if (typeof score !== "number") return "#e5e7eb"; // grey
  if (score === 100) return "#b7f7c2"; // light green
  if (score >= 90) return "#2ecc71"; // green
  if (score >= 70) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

export default function PupilDetailPage() {
  const router = useRouter();
  const pupilId = router.query.pupilId;

  const [me, setMe] = useState(null);
  const [pupil, setPupil] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(j.user);
      })
      .catch(() => window.location.href = "/teacher/login");
  }, []);

  useEffect(() => {
    if (!pupilId) return;
    setErr("");
    setPupil(null);
    setAttempts([]);
    setHeatmap(null);

    // 1) progress list
    fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(pupilId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load pupil");
        setPupil(j.student || null);
        setAttempts(j.series || []);
      })
      .catch((e) => setErr(String(e.message || e)));

    // 2) heatmap
    fetch(`/api/teacher/pupil_heatmap?student_id=${encodeURIComponent(pupilId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load heatmap");
        setHeatmap(j);
      })
      .catch((e) => setErr((prev) => prev || String(e.message || e)));
  }, [pupilId]);

  const title = useMemo(() => {
    const n =
      (pupil?.first_name || pupil?.name || "") +
      (pupil?.last_name ? ` ${pupil.last_name}` : "");
    return n.trim() || "Pupil";
  }, [pupil]);

  return (
    <div style={{ padding: 30 }}>
      {me && (
        <p>
          Logged in as <b>{me.email}</b> ({me.role})
        </p>
      )}

      <p>
        <Link href="/teacher/class-overview">← Back to class overview</Link> •{" "}
        <Link href="/teacher">Back to dashboard</Link>
      </p>

      {err && (
        <div style={{ background: "#fee2e2", padding: 12, borderRadius: 10, marginBottom: 16 }}>
          <b>{err}</b>
        </div>
      )}

      <h1 style={{ marginTop: 0 }}>{title}</h1>

      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Progress over time</h2>
        {attempts.length === 0 ? (
          <div>No attempts yet.</div>
        ) : (
          <ul>
            {attempts.map((a, idx) => (
              <li key={idx}>
                {new Date(a.date || a.created_at).toLocaleString("en-GB")} —{" "}
                <b>{typeof a.score === "number" ? `${a.score}%` : "—"}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Times Tables Heatmap</h2>
            <div style={{ color: "#555" }}>
              Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
            </div>
          </div>
          <div style={{ textAlign: "right", color: "#444" }}>
            <b>Key</b>
            <div style={{ fontSize: 13 }}>
              100% light green • 90–99% green • 70–89% orange • &lt;70% red
            </div>
          </div>
        </div>

        {!heatmap || !heatmap.matrix ? (
          <div style={{ marginTop: 14 }}>No heatmap data yet (or it failed to load).</div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 10 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Table</th>
                  {heatmap.attempts.map((a) => (
                    <th key={a.attempt_id} style={{ fontSize: 12, color: "#333" }}>
                      {new Date(a.created_at).toLocaleDateString("en-GB")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.tables.map((t) => (
                  <tr key={t}>
                    <td style={{ fontWeight: 800 }}>{t}×</td>
                    {heatmap.attempts.map((a) => {
                      const v = heatmap.matrix?.[t]?.[a.attempt_id] ?? null;
                      const bg = scoreColor(v);
                      const fg = typeof v === "number" && v < 70 ? "white" : "black";
                      return (
                        <td key={a.attempt_id}>
                          <div
                            style={{
                              width: 120,
                              height: 54,
                              borderRadius: 14,
                              background: bg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              color: fg,
                              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6)",
                            }}
                            title={typeof v === "number" ? `${v}%` : "No data"}
                          >
                            {typeof v === "number" ? `${v}%` : "—"}
                          </div>
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
    </div>
  );
}
