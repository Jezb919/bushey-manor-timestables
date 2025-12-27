import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function scoreColor(score) {
  if (typeof score !== "number") return "#f3f4f6"; // grey
  if (score === 100) return "#b7f7c2"; // light green
  if (score >= 90) return "#2ecc71"; // green
  if (score >= 70) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

export default function ClassOverviewPage() {
  const [me, setMe] = useState(null);
  const [classLabel, setClassLabel] = useState("M4");
  const [classes, setClasses] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  // load me (session)
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

  // load classes dropdown
  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setClasses(j.classes || []);
      })
      .catch(() => {});
  }, []);

  // load overview data
  async function load(label) {
    setErr("");
    setData(null);
    try {
      const r = await fetch(`/api/teacher/class_overview?class_label=${encodeURIComponent(label)}`);
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error || "Failed to load");
        return;
      }
      setData(j);
    } catch {
      setErr("Failed to load");
    }
  }

  useEffect(() => {
    load(classLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLabel]);

  const concernPills = useMemo(() => {
    const items = data?.concerns || [];
    return items.slice(0, 30);
  }, [data]);

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>Class Overview</h1>

      {me && (
        <p>
          Logged in as <b>{me.email}</b> ({me.role})
        </p>
      )}

      <p>
        <Link href="/teacher">← Back to dashboard</Link>
      </p>

      {err && (
        <div
          style={{
            background: "#fee2e2",
            padding: 12,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <b>{err}</b>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <select
          value={classLabel}
          onChange={(e) => setClassLabel(e.target.value)}
          style={{ padding: 10, borderRadius: 10 }}
        >
          {(classes.length ? classes : [{ class_label: "M4" }]).map((c) => (
            <option key={c.id || c.class_label} value={c.class_label}>
              {c.class_label}
            </option>
          ))}
        </select>

        <button
          onClick={() => load(classLabel)}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          Refresh
        </button>

        <button
          onClick={logout}
          style={{ marginLeft: "auto", padding: "10px 14px", borderRadius: 10 }}
        >
          Log out
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          marginBottom: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Concerns (≤ 70%) — {classLabel}</h2>
        <div style={{ color: "#555", marginBottom: 10 }}>
          Click a pupil to open full detail (graph + heatmap).
        </div>

        {concernPills.length === 0 ? (
          <div>No pupils currently at 70% or below.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {concernPills.map((p) => (
              <Link
                key={p.id}
                href={`/teacher/pupil/${p.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: scoreColor(p.latest_score),
                  color: p.latest_score < 70 ? "white" : "black",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                <span>{p.name}</span>
                <span style={{ opacity: 0.9 }}>
                  {typeof p.latest_score === "number" ? `${p.latest_score}%` : "—"}
                </span>
              </Link>
            ))}
          </div>
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
        <h2 style={{ marginTop: 0 }}>Pupils — {classLabel}</h2>
        <div style={{ color: "#555", marginBottom: 10 }}>
          Colour shows latest result. Click a row for pupil detail.
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "10px 8px" }}>Pupil</th>
              <th style={{ padding: "10px 8px" }}>Latest</th>
              <th style={{ padding: "10px 8px" }}>Recent</th>
              <th style={{ padding: "10px 8px" }}>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {(data?.pupils || []).length === 0 ? (
              <tr>
                <td style={{ padding: 12 }} colSpan={4}>
                  No pupils found for this class.
                </td>
              </tr>
            ) : (
              (data?.pupils || []).map((p) => (
                <tr
                  key={p.id}
                  onClick={() => (window.location.href = `/teacher/pupil/${p.id}`)}
                  style={{
                    cursor: "pointer",
                    background: scoreColor(p.latest_score),
                    color: typeof p.latest_score === "number" && p.latest_score < 70 ? "white" : "black",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <td style={{ padding: "12px 8px", fontWeight: 700 }}>{p.name}</td>
                  <td style={{ padding: "12px 8px", fontWeight: 800 }}>
                    {typeof p.latest_score === "number" ? `${p.latest_score}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {(p.recent_scores || []).length
                      ? p.recent_scores.map((s) => `${s}%`).join(", ")
                      : "—"}
                  </td>
                  <td style={{ padding: "12px 8px", fontWeight: 700 }}>{p.attempts_count || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 14, color: "#666" }}>
          Colour key: 100% light green • 90–99% green • 70–89% orange • &lt;70% red
        </div>
      </div>
    </div>
  );
}
