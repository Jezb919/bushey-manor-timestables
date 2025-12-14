// components/Heatmap.js

export default function Heatmap({
  data = [],
  scope = "class", // "student" | "class" | "year"
  onSelect,
}) {
  return (
    <div>
      <h3 style={titleStyle}>
        Times Table Heatmap (1–19)
        <span style={scopeStyle}>
          {scope === "student"
            ? " — Student"
            : scope === "year"
            ? " — Year Group"
            : " — Class"}
        </span>
      </h3>

      <div style={gridStyle}>
        {data.map((t) => {
          const accuracy =
            t.accuracy === null ? null : Math.round(t.accuracy);

          return (
            <div
              key={t.table_num}
              onClick={() => onSelect?.(t.table_num)}
              style={{
                ...tileStyle,
                background: colourForAccuracy(accuracy),
                cursor: onSelect ? "pointer" : "default",
              }}
            >
              <div style={tableLabel}>Table</div>

              <div style={tableNumber}>{t.table_num}</div>

              <div style={metaText}>
                {t.correct ?? 0}/{t.total ?? 0} correct
              </div>

              <div style={accuracyText}>
                Accuracy: {accuracy === null ? "—" : `${accuracy}%`}
              </div>
            </div>
          );
        })}
      </div>

      <div style={legendStyle}>
        <LegendItem colour="#16a34a" label="Strong (≥90%)" />
        <LegendItem colour="#84cc16" label="Secure (75–89%)" />
        <LegendItem colour="#facc15" label="Developing (50–74%)" />
        <LegendItem colour="#fb923c" label="Weak (25–49%)" />
        <LegendItem colour="#ef4444" label="Very weak (<25%)" />
        <LegendItem colour="#334155" label="No data yet" />
      </div>
    </div>
  );
}

/* -------------------- STYLES -------------------- */

const titleStyle = {
  color: "#facc15",
  marginBottom: 12,
};

const scopeStyle = {
  fontSize: "0.9rem",
  fontWeight: 400,
  color: "#e5e7eb",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14,
};

const tileStyle = {
  padding: "14px 12px",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.25)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

const tableLabel = {
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const tableNumber = {
  fontSize: 28,
  fontWeight: 900,
  margin: "2px 0",
};

const metaText = {
  fontSize: 12,
  color: "#e5e7eb",
};

const accuracyText = {
  fontSize: 12,
  fontWeight: 700,
  color: "#f8fafc",
};

const legendStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 16,
};

function LegendItem({ colour, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: colour,
        }}
      />
      <span style={{ fontSize: 12, color: "#e5e7eb" }}>{label}</span>
    </div>
  );
}

/* -------------------- COLOURS -------------------- */

function colourForAccuracy(a) {
  if (a === null) return "#334155"; // no data
  if (a >= 90) return "#16a34a"; // green
  if (a >= 75) return "#84cc16"; // light green
  if (a >= 50) return "#facc15"; // yellow
  if (a >= 25) return "#fb923c"; // orange
  return "#ef4444"; // red
}
