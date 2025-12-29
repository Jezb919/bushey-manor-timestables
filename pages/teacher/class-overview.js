// pages/teacher/class-overview.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

function colourForScore(score) {
  if (score === null || score === undefined) return { bg: "#f5f5f5", fg: "#111" };
  const s = Number(score);
  if (Number.isNaN(s)) return { bg: "#f5f5f5", fg: "#111" };
  if (s === 100) return { bg: "#b9ffb9", fg: "#111" };
  if (s >= 90) return { bg: "#44c767", fg: "#fff" };
  if (s >= 70) return { bg: "#ffb347", fg: "#111" };
  return { bg: "#ff2b55", fg: "#fff" };
}

export default function ClassOverview() {
  const router = useRouter();
  const initialFromUrl = (router.query.class_label || "").toString();

  const [allowed, setAllowed] = useState([]);
  const [classLabel, setClassLabel] = useState(initialFromUrl || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load(nextLabel) {
    const label = (nextLabel ?? classLabel ?? "").toString();

    setLoading(true);
    setErr("");

    try {
      const url = `/api/teacher/class_overview?class_label=${encodeURIComponent(label)}`;
      const resp = await fetch(url, { credentials: "include" });

      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Request failed (${resp.status})`);
      }

      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || `Request failed (${resp.status})`);
      }

      const allowed_classes = Array.isArray(data.allowed_classes) ? data.allowed_classes : [];
      setAllowed(allowed_classes);

      // API may “snap” to first allowed if teacher chooses a class they’re not allowed.
      const selected = data?.class?.class_label || allowed_classes[0] || "";
      setClassLabel(selected);

      setRows(Array.isArray(data.rows) ? data.rows : []);

      // keep URL in sync
      router.replace(
        { pathname: "/teacher/class-overview", query: selected ? { class_label: selected } : {} },
        undefined,
        { shallow: true }
      );
    } catch (e) {
      setRows([]);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Initial load (and when URL changes first time)
  useEffect(() => {
    load(initialFromUrl || classLabel || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChangeClass(e) {
    const next = e.target.value;
    setClassLabel(next);
    load(next);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 52, margin: 0 }}>Class Overview</h1>
      <div style={{ marginTop: 8, marginBottom: 14 }}>
        <Link href="/teacher/dashboard">← Back to dashboard</Link>
      </div>

      {err && (
        <div
          style={{
            background: "#ffe6e6",
            border: "1px solid #ffb3b3",
            color: "#a40000",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            fontWeight: 700,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <select
          value={classLabel}
          onChange={onChangeClass}
          disabled={!allowed.length}
          style={{ padding: "10px 12px", borderRadius: 10 }}
        >
          {allowed.length ? (
            allowed.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))
          ) : (
            <option value="">No classes</option>
          )}
        </select>

        <button
          onClick={() => load(classLabel)}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "2px solid #111",
            background: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ fontSize: 34, margin: 0 }}>Pupils — {classLabel || "—"}</h2>
        <p style={{ marginTop: 6, color: "#333" }}>Colour shows latest result. Click a row for pupil detail.</p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e6e6e6" }}>
                <th style={{ padding: "12px 10px" }}>Pupil</th>
                <th style={{ padding: "12px 10px" }}>Latest</th>
                <th style={{ padding: "12px 10px" }}>Recent</th>
                <th style={{ padding: "12px 10px" }}>Attempts</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 14 }}>
                    No pupils found for this class.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const { bg, fg } = colourForScore(r.latest_score);
                  return (
                    <tr
                      key={r.pupil_id}
                      onClick={() => router.push(`/teacher/pupil/${r.pupil_id}`)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        background: bg,
                        color: fg,
                      }}
                      title="Click for pupil detail"
                    >
                      <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                        {r.pupil_name}{" "}
                        <span style={{ fontWeight: 700, opacity: 0.9 }}>({r.username})</span>
                      </td>
                      <td style={{ padding: "12px 10px", fontWeight: 900 }}>
                        {r.latest_score === null || r.latest_score === undefined ? "—" : `${r.latest_score}%`}
                      </td>
                      <td style={{ padding: "12px 10px", fontWeight: 800 }}>
                        {Array.isArray(r.recent) && r.recent.length
                          ? r.recent.map((x, i) => (
                              <span key={i} style={{ marginRight: 10 }}>
                                {x ?? "—"}%
                              </span>
                            ))
                          : "—"}
                      </td>
                      <td style={{ padding: "12px 10px", fontWeight: 900 }}>{r.attempts ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#555" }}>
          Colour key: <b>100%</b> light green • <b>90–99%</b> green • <b>70–89%</b> orange • <b>&lt;70%</b> red
        </div>
      </div>
    </div>
  );
}
