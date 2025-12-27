import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// Chart.js line chart (same approach you used before)
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

export default function PupilDetailPage() {
  const router = useRouter();
  const { id } = router.query; // ✅ UUID from URL /teacher/pupil/<uuid>

  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
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

  async function loadAll(studentId) {
    setError("");

    // 1) attainment series
    const r1 = await fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(studentId)}`);
    const j1 = await r1.json();
    if (!j1.ok) {
      setError(j1.error || "Failed to load pupil");
      setStudent(null);
      setSeries([]);
      setHeatmap(null);
      return;
    }
    setStudent(j1.student || null);
    setSeries(j1.series || []);

    // 2) heatmap
    const r2 = await fetch(`/api/teacher/pupil_heatmap?student_id=${encodeURIComponent(studentId)}`);
    const j2 = await r2.json();
    if (j2.ok) setHeatmap(j2);
    else setHeatmap(null);
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (!id) return;
    loadAll(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const name = useMemo(() => {
    if (!student) return "Pupil";
    const fn = student.first_name || "";
    const sn = student.surname || "";
    const full = `${fn} ${sn}`.trim();
    return full || "Pupil";
  }, [student]);

  const chartData = useMemo(() => {
    const labels = (series || []).map((p) =>
      new Date(p.date).toLocaleDateString("en-GB")
    );
    const data = (series || []).map((p) => p.score);

    return {
      labels,
      datasets: [
        {
          label: "Score (%)",
          data,
          tension: 0.35,
        },
      ],
    };
  }, [series]);

  if (!me) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ opacity: 0.85 }}>
            Logged in as <b>{me.email}</b> ({me.role})
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/teacher/class-overview">← Back to class overview</Link>{" "}
            • <Link href="/teacher">Back to dashboard</Link>
          </div>
        </div>

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

      {error && (
        <div style={{ marginTop: 16, background: "#fee2e2", padding: 12, borderRadius: 12, color: "#7f1d1d" }}>
          {error}
        </div>
      )}

      <h1 style={{ marginTop: 18 }}>{name}</h1>

      {/* Graph */}
      <div style={{ marginTop: 14, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>Progress over time</h2>

        {(series || []).length === 0 ? (
          <div style={{ opacity: 0.8 }}>No attempts yet.</div>
        ) : (
          <div style={{ height: 340 }}>
            <Line data={chartData} />
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div style={{ marginTop: 18, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h2 style={{ marginTop: 0 }}>Times Tables Heatmap</h2>
        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          Rows = table (1–19) • Columns = most recent attempts • Colours follow your key
        </div>

        {!heatmap ? (
          <div style={{ opacity: 0.8 }}>No heatmap data yet (or it failed to load).</div>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 12 }}>
            {JSON.stringify(heatmap, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
