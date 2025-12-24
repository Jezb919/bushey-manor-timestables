import { useEffect, useMemo, useState } from "react";

function scoreColour(score) {
  const s = Number(score);
  if (s === 100) return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.4)", text: "#166534" };
  if (s >= 90 && s <= 99) return { bg: "rgba(21,128,61,0.15)", border: "rgba(21,128,61,0.4)", text: "#14532d" };
  if (s >= 70 && s <= 89) return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", text: "#92400e" };
  return { bg: "rgba(185,28,28,0.15)", border: "rgba(185,28,28,0.4)", text: "#7f1d1d" };
}

function prettyMonth(ym) {
  const [y, m] = String(ym).split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[Number(m) - 1]} ${String(y).slice(2)}`;
}

export default function AttainmentOverviewPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [months, setMonths] = useState([]);
  const [rows, setRows] = useState([]);
  const [cls, setCls] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setError("");
        const r = await fetch("/api/teacher/classes");
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load classes");
        setClasses(j.classes || []);
        if (j.classes?.length) setClassId(j.classes[0].id);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        setError("");
        const r = await fetch(`/api/teacher/attainment/class-overview?class_id=${encodeURIComponent(classId)}`);
        const j = await r.json();
        if (!j.ok) return setError(j.error || "Failed to load overview");
        setCls(j.class || null);
        setMonths(j.months || []);
        setRows(j.students || []);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [classId]);

  const tableHead = useMemo(() => {
    return (
      <tr>
        <th style={thStyle}>Pupil</th>
        {months.map((m) => (
          <th key={m} style={thStyle}>{prettyMonth(m)}</th>
        ))}
      </tr>
    );
  }, [months]);

  return (
    <div style={{ padding: 20, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Class Overview</h1>

        {error ? (
          <div style={{ color: "#b91c1c", marginBottom: 12, fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 14,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 800 }}>Class</div>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              minWidth: 240,
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_label}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.75, fontSize: 12 }}>
            Colour key: 100% light green • 90–99% dark green • 70–89% orange • &lt;70% red
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            overflowX: "auto",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            {cls ? `${cls.class_label} (Year ${cls.year_group})` : "Loading..."}
          </div>

          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
            <thead>{tableHead}</thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={nameCell}>{r.name}</td>
                  {months.map((m) => {
                    const v = r.values?.[m];
                    if (v == null) return <td key={m} style={emptyCell}>—</td>;
                    const c = scoreColour(v);
                    return (
                      <td
                        key={m}
                        style={{
                          ...scoreCell,
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          color: c.text,
                        }}
                      >
                        {v}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {!rows.length ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>
              No pupils found in this class yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  opacity: 0.75,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
  position: "sticky",
  top: 0,
  background: "#fff",
};

const nameCell = {
  padding: "10px 12px",
  fontWeight: 900,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  whiteSpace: "nowrap",
};

const scoreCell = {
  padding: "10px 12px",
  fontWeight: 900,
  textAlign: "center",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 10,
  whiteSpace: "nowrap",
};

const emptyCell = {
  padding: "10px 12px",
  textAlign: "center",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
  opacity: 0.5,
  whiteSpace: "nowrap",
};
