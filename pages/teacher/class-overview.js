import { useEffect, useState } from "react";
import Link from "next/link";

function colourFor(score) {
  if (score === null || score === undefined) return "#f1f5f9";
  if (score === 100) return "#dcfce7";
  if (score >= 90) return "#86efac";
  if (score >= 70) return "#fed7aa";
  return "#fecaca";
}

export default function ClassOverviewPage() {
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState("");
  const [pupils, setPupils] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(class_label) {
    setLoading(true);
    setErr("");
    try {
      const url = class_label
        ? `/api/teacher/class-overview?class_label=${encodeURIComponent(class_label)}`
        : `/api/teacher/class-overview`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Failed");
      setClasses(j.classes || []);
      setSelected(j.selected || "");
      setPupils(j.pupils || []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
  }, []);

  function onChangeClass(e) {
    const v = e.target.value;
    setSelected(v);
    load(v);
  }

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 46, fontWeight: 900, margin: 0 }}>Class overview</h1>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              Colour key: 100% light green • 90–99% green • 70–89% orange • &lt;70% red
            </div>
          </div>
          <Link href="/teacher/dashboard" style={{ fontWeight: 900 }}>
            Back to dashboard
          </Link>
        </div>

        {err && <div style={{ color: "#b91c1c", fontWeight: 900, marginTop: 12 }}>{err}</div>}

        <div style={card}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>Class</div>
            <select value={selected} onChange={onChangeClass} style={select}>
              {(classes || []).map((c) => (
                <option key={c.id} value={c.class_label}>
                  {c.class_label}
                </option>
              ))}
            </select>

            <div style={{ marginLeft: "auto", opacity: 0.7 }}>
              Rows clickable → opens individual graphs
            </div>
          </div>
        </div>

        <div style={card}>
          {loading ? (
            <div style={{ padding: 10 }}>Loading…</div>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Pupil</th>
                  <th style={th}>Latest</th>
                  <th style={th}>Last 5</th>
                  <th style={th}>Avg (last 10)</th>
                  <th style={thRight}>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => {
                  const rowBg = colourFor(p.latest);
                  const link = `/teacher/pupil/${encodeURIComponent(p.id)}`;


                  return (
                    <tr
                      key={p.id}
                      onClick={() => (window.location.href = link)}
                      style={{ cursor: "pointer", background: rowBg }}
                      title="Click to open individual graphs"
                    >
                      <td style={tdStrong}>{p.name || "—"}</td>
                      <td style={{ ...td, fontWeight: 900 }}>
                        {p.latest === null ? "—" : `${p.latest}%`}
                      </td>
                      <td style={tdMono}>
                        {p.last5?.length ? p.last5.map((x) => `${x}%`).join(", ") : "—"}
                      </td>
                      <td style={td}>{p.avg10 === null ? "—" : `${p.avg10}%`}</td>
                      <td style={tdRight}>{p.attempts_count || 0}</td>
                    </tr>
                  );
                })}

                {!pupils.length && (
                  <tr>
                    <td style={td} colSpan={5}>
                      No pupils found in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
  border: "1px solid rgba(0,0,0,0.06)",
  marginTop: 16,
};

const select = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  fontWeight: 900,
};

const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, opacity: 0.7, borderBottom: "1px solid rgba(0,0,0,0.1)", background: "#fff" };
const thRight = { ...th, textAlign: "right" };
const td = { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" };
const tdStrong = { ...td, fontWeight: 900 };
const tdMono = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const tdRight = { ...td, textAlign: "right", fontWeight: 900 };
