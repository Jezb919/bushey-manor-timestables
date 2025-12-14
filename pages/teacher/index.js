import { useEffect, useState } from "react";

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await fetch("/api/teacher/overview", { method: "GET" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json && (json.error || json.details)) ||
              `Request failed (${res.status})`
          );
        }

        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load teacher overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerRow}>
          <div style={brandLeft}>
            <div style={logoCircle}>
              <span style={logoText}>BM</span>
            </div>
            <div>
              <div style={kicker}>Teacher Dashboard</div>
              <div style={title}>Times Tables Arena</div>
            </div>
          </div>

          <a href="/" style={backLink}>
            Home
          </a>
        </div>

        {/* Body */}
        {loading && (
          <div style={panel}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              Loading dashboard…
            </div>
            <p style={{ marginTop: "0.5rem", color: "#cbd5e1" }}>
              If this takes more than a few seconds, open{" "}
              <strong>/api/teacher/overview</strong> in a new tab to see what it
              returns.
            </p>
          </div>
        )}

        {!loading && err && (
          <div style={{ ...panel, borderColor: "rgba(239,68,68,0.5)" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fecaca" }}>
              Couldn’t load dashboard
            </div>
            <p style={{ marginTop: "0.5rem", color: "#e2e8f0" }}>{err}</p>

            <div style={{ marginTop: "1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>
                Quick checks:
              </div>
              <ol style={{ margin: 0, paddingLeft: "1.2rem", color: "#cbd5e1" }}>
                <li>
                  Open <strong>/api/teacher/overview</strong> in a new tab and
                  confirm you see JSON (not a 404).
                </li>
                <li>
                  If it errors, paste the JSON error message here.
                </li>
              </ol>
            </div>
          </div>
        )}

        {!loading && !err && (
          <>
            {/* Summary row */}
            <div style={grid3}>
              <StatCard
                label="Total Attempts"
                value={safeNumber(data?.totals?.attempts)}
              />
              <StatCard
                label="Total Students"
                value={safeNumber(data?.totals?.students)}
              />
              <StatCard
                label="Average Score %"
                value={formatPercent(data?.totals?.avg_percent)}
              />
            </div>

            {/* Leaderboards / tables */}
            <div style={{ marginTop: "1rem" }}>
              <div style={sectionTitle}>Latest Attempts</div>
              <div style={panel}>
                <Table
                  columns={[
                    "created_at",
                    "student",
                    "class",
                    "score",
                    "total",
                    "percent",
                  ]}
                  rows={Array.isArray(data?.latestAttempts) ? data.latestAttempts : []}
                />
              </div>

              <div style={{ marginTop: "1rem" }}>
                <div style={sectionTitle}>Class Leaderboard</div>
                <div style={panel}>
                  <Table
                    columns={["class", "attempts", "avg_percent"]}
                    rows={Array.isArray(data?.classLeaderboard) ? data.classLeaderboard : []}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem", color: "#cbd5e1", fontSize: "0.9rem" }}>
              Next step (once this page shows data): we’ll add filters (class/year),
              “top 10%”, “most improved”, colour bands, and a tables heatmap.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Components ---------------- */

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function Table({ columns, rows }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: "#cbd5e1" }}>No data yet — run a few tests first.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={thStyle}>
                {pretty(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((r, idx) => (
            <tr key={idx}>
              {columns.map((c) => (
                <td key={c} style={tdStyle}>
                  {formatCell(r?.[c], c, r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function pretty(key) {
  return String(key).replaceAll("_", " ").toUpperCase();
}

function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function formatPercent(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0%";
  return `${Math.round(x)}%`;
}

function formatCell(val, col, row) {
  if (val === null || val === undefined) return "—";

  if (col === "percent" || col === "avg_percent") return formatPercent(val);

  if (col === "student") {
    // Your API might send student_name, first_name, etc.
    if (typeof val === "string") return val;
    if (row?.first_name) return row.first_name;
    return "—";
  }

  if (col === "class") {
    return row?.class_label || row?.class || row?.class_name || val;
  }

  if (col === "created_at") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  }

  return String(val);
}

/* ---------------- Styles ---------------- */

const outerStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, #facc15 0, #0f172a 35%, #020617 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  color: "white",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const cardStyle = {
  background: "rgba(3,7,18,0.92)",
  borderRadius: "22px",
  padding: "1.75rem 2.25rem",
  maxWidth: "1000px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.55)",
  border: "1px solid rgba(148,163,184,0.35)",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  marginBottom: "1rem",
};

const brandLeft = { display: "flex", alignItems: "center", gap: "0.75rem" };

const logoCircle = {
  width: "58px",
  height: "58px",
  borderRadius: "50%",
  background: "white",
  border: "3px solid #facc15",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logoText = { fontWeight: 900, fontSize: "1.2rem", color: "#0f172a" };

const kicker = {
  fontSize: "0.75rem",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#e5e7eb",
};

const title = { fontSize: "1.3rem", fontWeight: 900, color: "#facc15" };

const backLink = {
  color: "#e2e8f0",
  textDecoration: "underline",
  fontSize: "0.9rem",
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "0.9rem",
};

const statCard = {
  background: "rgba(2,6,23,0.6)",
  border: "1px solid rgba(148,163,184,0.25)",
  borderRadius: "16px",
  padding: "1rem",
};

const statLabel = { color: "#cbd5e1", fontSize: "0.85rem", letterSpacing: "0.08em" };
const statValue = { fontSize: "1.8rem", fontWeight: 900, color: "#f8fafc", marginTop: "0.25rem" };

const sectionTitle = { marginTop: "0.75rem", fontWeight: 900, color: "#facc15" };

const panel = {
  marginTop: "0.75rem",
  padding: "1rem",
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(2,6,23,0.55)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.9rem",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 10px",
  color: "#facc15",
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 10px",
  color: "#e2e8f0",
  borderBottom: "1px solid rgba(148,163,184,0.15)",
  whiteSpace: "nowrap",
};
