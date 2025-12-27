import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function scoreToColour(score) {
  if (score === null || score === undefined) return "#f3f4f6"; // grey
  if (score >= 100) return "#b7f7c7"; // light green
  if (score >= 90) return "#16a34a"; // green
  if (score >= 70) return "#f59e0b"; // orange
  return "#ef4444"; // red
}

export default function ClassOverviewPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);

  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("M4");

  const [rows, setRows] = useState([]);
  const [concerns, setConcerns] = useState([]);
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

  async function loadClasses() {
    const r = await fetch("/api/teacher/classes");
    const j = await r.json();
    if (!j.ok) {
      setError(j.error || "Failed to load classes");
      return;
    }
    setClasses(j.classes || []);
    // Preselect first class if not set
    if (!classLabel && j.classes?.length) setClassLabel(j.classes[0].class_label);
  }

  async function loadOverview(label) {
    if (!label) return;
    setError("");
    const r = await fetch(`/api/teacher/class_overview?class_label=${encodeURIComponent(label)}`);
    const j = await r.json();
    if (!j.ok) {
      setError(j.error || "Failed to load pupils");
      setRows([]);
      setConcerns([]);
      return;
    }
    setRows(j.rows || []);
    setConcerns(j.concerns || []);
  }

  useEffect(() => {
    loadMe();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOverview(classLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classLabel]);

  const concernText = useMemo(() => `Concerns (≤ 70%) — ${classLabel}`, [classLabel]);

  function openPupil(pupilRow) {
    // ✅ IMPORTANT: always use pupilRow.id (uuid)
    // This sends you to: /teacher/pupil/<uuid>
    router.push(`/teacher/pupil/${pupilRow.id}`);
  }

  if (!me) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Class Overview</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Logged in as <b>{me.email}</b> ({me.role})
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/teacher">← Back to dashboard</Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={classLabel}
            onChange={(e) => setClassLabel(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10 }}
          >
            {(classes || []).map((c) => (
              <option key={c.id} value={c.class_label}>
                {c.class_label}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadOverview(classLabel)}
            style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}
          >
            Refresh
          </button>

          <button
            onClick={async () => {
              await fetch("/api/teacher/logout", { method: "POST" });
              window.location.href = "/teacher/login";
            }}
            style={{ padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}
          >
            Log out
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, background: "#fee2e2", padding: 12, borderRadius: 12, color: "#7f1d1d" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 20, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>{concernText}</h2>
        <div style={{ opacity: 0.8, marginBottom: 10 }}>
          Click a pupil to open full detail (graph + heatmap).
        </div>

        {(!concerns || concerns.length === 0) ? (
          <div style={{ opacity: 0.8 }}>No pupils currently at 70% or below.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {concerns.map((p) => (
              <button
                key={p.id}
                onClick={() => openPupil(p)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: scoreToColour(p.latest_score),
                  color: p.latest_score >= 90 ? "#052e16" : "#fff",
                  fontWeight: 800,
                }}
                title="Open pupil detail"
              >
                — {p.latest_score ?? 0}%
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>Pupils — {classLabel}</h2>
        <div style={{ opacity: 0.8, marginBottom: 10 }}>
          Colour shows latest result. Click a row for pupil detail.
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>Pupil</th>
                <th style={{ padding: "10px 8px" }}>Latest</th>
                <th style={{ padding: "10px 8px" }}>Recent</th>
                <th style={{ padding: "10px 8px" }}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((p) => {
                const bg = scoreToColour(p.latest_score);
                const textColour = (p.latest_score ?? 0) >= 90 ? "#052e16" : "#fff";
                const name =
                  (p.first_name || p.surname)
                    ? `${p.first_name || ""} ${p.surname || ""}`.trim()
                    : "(no name)";

                return (
                  <tr
                    key={p.id}
                    onClick={() => openPupil(p)}
                    style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                    title="Open pupil detail"
                  >
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>{name}</td>

                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          minWidth: 60,
                          textAlign: "center",
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: bg,
                          color: textColour,
                          fontWeight: 900,
                        }}
                      >
                        {p.latest_score === null || p.latest_score === undefined ? "—" : `${p.latest_score}%`}
                      </span>
                    </td>

                    <td style={{ padding: "12px 8px", opacity: 0.9 }}>
                      {p.recent_text || "—"}
                    </td>

                    <td style={{ padding: "12px 8px", fontWeight: 800 }}>
                      {p.attempt_count ?? 0}
                    </td>
                  </tr>
                );
              })}
              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ padding: "14px 8px", opacity: 0.8 }}>
                    No pupils found for this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
