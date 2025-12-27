import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function scoreToColour(score) {
  if (score === null || score === undefined) return "#e5e7eb"; // grey
  if (score >= 100) return "#b7f7c7"; // light green
  if (score >= 90) return "#16a34a"; // green
  if (score >= 70) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

function scoreToVibrantGradient(score) {
  // brighter, more “heatmap” feel (still following your 4 bands)
  if (score === null || score === undefined) return "linear-gradient(135deg,#e5e7eb,#f3f4f6)";
  if (score >= 100) return "linear-gradient(135deg,#86efac,#bbf7d0)";
  if (score >= 90) return "linear-gradient(135deg,#16a34a,#22c55e)";
  if (score >= 70) return "linear-gradient(135deg,#f59e0b,#fbbf24)";
  return "linear-gradient(135deg,#ef4444,#fb7185)";
}

export default function PupilPage() {
  const router = useRouter();
  const { id } = router.query; // ✅ this is the pupil UUID from /teacher/pupil/<uuid>

  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const [attemptsList, setAttemptsList] = useState([]);
  const [heatmap, setHeatmap] = useState(null);

  async function loadMe() {
    const r = await fetch("/api/teacher/me");
    const j = await r.json();
    if (!j.ok) {
      window.location.href = "/teacher/login";
      return;
    }
    setMe(j.user);
  }

  async function loadPupilDetail(studentId) {
    setError("");

    // Progress list (we’ll use attempts list from heatmap API too, but keep this simple)
    const r = await fetch(`/api/teacher/pupil_heatmap?student_id=${encodeURIComponent(studentId)}`);
    const j = await r.json();
    if (!j.ok) {
      setError(j.error || "Failed to load pupil");
      setHeatmap(null);
      setAttemptsList([]);
      return;
    }
    setHeatmap(j);
    setAttemptsList(j.attempts || []);
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (!id) return;
    loadPupilDetail(id);
  }, [id]);

  const title = useMemo(() => "Pupil", []);

  if (!me) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        Logged in as <b>{me.email}</b> ({me.role})
      </div>

      <div style={{ marginBottom: 18 }}>
        <Link href="/teacher/class-overview">← Back to class overview</Link>{" "}
        • <Link href="/teacher">Back to dashboard</Link>
      </div>

      {error && (
        <div style={{ marginBottom: 14, background: "#fee2e2", padding: 12, borderRadius: 12, color: "#7f1d1d" }}>
          {error}
        </div>
      )}

      <h1 style={{ marginTop: 0 }}>{title}</h1>

      {/* Progress over time */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>Progress over time</h2>
        {attemptsList.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No attempts yet.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {attemptsList.map((a) => (
              <li key={a.id}>
                {new Date(a.date).toLocaleString("en-GB")}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Heatmap */}
      <div style={{ marginTop: 18, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Times Tables Heatmap</h2>
            <div style={{ opacity: 0.8 }}>
              Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
            </div>
          </div>

          <div style={{ textAlign: "right", opacity: 0.9 }}>
            <div style={{ fontWeight: 700 }}>Key</div>
            <div style={{ fontSize: 13 }}>
              100% light green • 90–99% green • 70–89% orange • &lt;70% red
            </div>
          </div>
        </div>

        {!heatmap || !heatmap.attempts || heatmap.attempts.length === 0 ? (
          <div style={{ marginTop: 14, opacity: 0.8 }}>
            No heatmap data yet (or it failed to load). Once the pupil has attempts, it will appear here.
          </div>
        ) : (
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <div style={{ minWidth: 700 }}>
              {/* header row */}
              <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${heatmap.attempts.length}, 110px)`, gap: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 800 }}>Table</div>
                {heatmap.attempts.map((a) => (
                  <div key={a.id} style={{ fontWeight: 800 }}>
                    {a.label}
                  </div>
                ))}
              </div>

              {/* rows */}
              {(heatmap.rows || []).map((r) => (
                <div
                  key={r.table}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${heatmap.attempts.length}, 110px)`,
                    gap: 10,
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{r.table}×</div>

                  {(r.cells || []).map((score, idx) => {
                    const bg = scoreToVibrantGradient(score);
                    const text = score === null ? "—" : `${score}%`;
                    const textColor = score !== null && score >= 90 ? "#052e16" : "#fff";
                    const border = score === null ? "1px solid #e5e7eb" : "1px solid rgba(0,0,0,0.08)";

                    return (
                      <div
                        key={idx}
                        title={score === null ? "No questions for this table in that attempt" : `${score}%`}
                        style={{
                          height: 44,
                          borderRadius: 12,
                          background: bg,
                          border,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          color: score === null ? "#111827" : textColor,
                          boxShadow: score === null ? "none" : "0 10px 20px rgba(0,0,0,0.08)",
                          letterSpacing: 0.2,
                        }}
                      >
                        {text}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
