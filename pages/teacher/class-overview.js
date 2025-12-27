import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// Your colours:
// 100% = light green
// 90–99 = dark green
// 70–89 = orange
// <70 = red
function colourFor(score) {
  if (score === null || score === undefined) return "#e5e7eb";
  if (score === 100) return "#00ff88";
  if (score >= 90) return "#00c853";
  if (score >= 70) return "#ff9800";
  return "#ff1744";
}

function textColour(bg) {
  if (bg === "#ff1744" || bg === "#00c853") return "white";
  return "#0f172a";
}

// ✅ Extract first UUID from any string (prevents concatenated-ID bugs)
function firstUuid(str) {
  const m = String(str || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

export default function ClassOverviewPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function safeJson(res) {
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      throw new Error(txt || `HTTP ${res.status}`);
    }
  }

  async function loadClassesAndDefault() {
    // Who am I?
    const mr = await fetch("/api/teacher/me");
    const mj = await safeJson(mr);
    if (!mj.ok) {
      window.location.href = "/teacher/login";
      return;
    }
    setMe(mj.user);

    // Load classes teacher can see (admin sees all)
    const cr = await fetch("/api/teacher/classes");
    const cj = await safeJson(cr);
    if (!cj.ok) throw new Error(cj.error || "Failed to load classes");

    const cls = cj.classes || [];
    setClasses(cls);

    const defaultLabel = cls[0]?.class_label || "M4";
    setClassLabel(defaultLabel);

    return defaultLabel;
  }

  async function loadOverview(label) {
    setErr("");
    setLoading(true);

    try {
      // Your API endpoint in your repo is class_overview (underscore)
      const r = await fetch(`/api/teacher/class_overview?class_label=${encodeURIComponent(label)}`);
      const j = await safeJson(r);

      if (!j.ok) throw new Error(j.error || "Failed to load class overview");

      // We accept multiple possible shapes so it won’t break if your API differs slightly:
      // - j.pupils
      // - j.students
      // - j.rows
      const list = j.pupils || j.students || j.rows || [];
      setRows(list);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const defaultLabel = await loadClassesAndDefault();
        if (defaultLabel) await loadOverview(defaultLabel);
      } catch (e) {
        setErr(String(e.message || e));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onChangeClass(e) {
    const v = e.target.value;
    setClassLabel(v);
    await loadOverview(v);
  }

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  const concerns = useMemo(() => {
    // Concern is 70% or lower (you asked that)
    return (rows || []).filter((p) => {
      const s = p.latest_score ?? p.latest ?? p.score ?? p.last_score ?? null;
      if (s === null || s === undefined) return false;
      return Number(s) <= 70;
    });
  }, [rows]);

  const className = classLabel || "—";

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={{ margin: 0 }}>Class Overview</h1>
          <div style={{ opacity: 0.7 }}>
            {me ? (
              <>
                Logged in as <b>{me.email}</b> ({me.role})
              </>
            ) : (
              "Loading user…"
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <Link href="/teacher/dashboard">← Back to dashboard</Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={classLabel} onChange={onChangeClass} style={input}>
            {classes.map((c) => (
              <option key={c.id || c.class_label} value={c.class_label}>
                {c.class_label}
              </option>
            ))}
          </select>
          <button onClick={() => loadOverview(classLabel)} style={btn}>Refresh</button>
          <button onClick={logout} style={btnDark}>Log out</button>
        </div>
      </div>

      {err && <div style={errorBox}>{err}</div>}

      {/* Concern list */}
      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Concerns (≤ 70%) — {className}</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
          Click a pupil to open full detail (graph + heatmap).
        </div>

        {loading ? (
          <div style={{ marginTop: 12 }}>Loading…</div>
        ) : concerns.length ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            {concerns.map((p) => {
              const score = p.latest_score ?? p.latest ?? p.score ?? p.last_score ?? null;
              const bg = colourFor(score);
              const id = firstUuid(p.id);
              return (
                <button
                  key={p.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: "2px solid rgba(15,23,42,0.12)",
                    background: bg,
                    color: textColour(bg),
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
                  }}
                  onClick={() => id && (window.location.href = `/teacher/pupil/${id}`)}
                  title="Open pupil detail"
                >
                  {(p.first_name || p.firstName || "")} {(p.surname || p.last_name || p.lastName || "")} —{" "}
                  {score === null ? "—" : `${score}%`}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ marginTop: 12, opacity: 0.8 }}>No pupils currently at 70% or below.</div>
        )}
      </div>

      {/* Full class table */}
      <div style={card}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Pupils — {className}</div>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
          Colour shows latest result. Click a row for pupil detail.
        </div>

        {loading ? (
          <div style={{ marginTop: 12 }}>Loading…</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Pupil</th>
                <th style={th}>Latest</th>
                <th style={th}>Recent</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((p) => {
                const score = p.latest_score ?? p.latest ?? p.score ?? p.last_score ?? null;
                const bg = colourFor(score);
                const tc = textColour(bg);

                const first = p.first_name ?? p.firstName ?? "";
                const last = p.surname ?? p.last_name ?? p.lastName ?? "";
                const name = `${first} ${last}`.trim() || "(no name)";

                // recent could be array of last few scores
                const recent = p.recent_scores ?? p.recent ?? p.last_scores ?? [];
                const recentText = Array.isArray(recent) ? recent.slice(0, 5).map((x) => `${x}%`).join(" • ") : "";

                const id = firstUuid(p.id); // ✅ prevents the concatenation bug

                return (
                  <tr
                    key={p.id}
                    onClick={() => id && (window.location.href = `/teacher/pupil/${id}`)}
                    style={{
                      background: bg,
                      color: tc,
                      cursor: id ? "pointer" : "default",
                    }}
                    title="Open pupil detail"
                  >
                    <td style={{ ...td, fontWeight: 900 }}>{name}</td>
                    <td style={{ ...td, fontWeight: 900 }}>{score === null ? "—" : `${score}%`}</td>
                    <td style={td}>{recentText || "—"}</td>
                  </tr>
                );
              })}

              {!rows?.length && (
                <tr>
                  <td style={td} colSpan={3}>
                    No pupils found for this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* styles */
const page = { padding: 24, background: "#f3f4f6", minHeight: "100vh" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" };
const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  marginTop: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
};
const input = { padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", fontWeight: 900 };
const btn = { padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.2)", background: "#fff", fontWeight: 900, cursor: "pointer" };
const btnDark = { ...btn, background: "#0f172a", color: "#fff", border: "1px solid #0f172a" };
const errorBox = { marginTop: 14, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontWeight: 900 };

const table = { width: "100%", borderCollapse: "collapse", marginTop: 12 };
const th = { textAlign: "left", padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.12)", opacity: 0.7, fontSize: 12 };
const td = { padding: "10px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
