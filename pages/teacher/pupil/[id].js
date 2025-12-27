import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Grabs the first UUID it can find in a string
function extractUuid(anyValue) {
  if (!anyValue) return null;
  const s = String(anyValue);
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

export default function PupilDetailPage() {
  const router = useRouter();

  const pupilId = useMemo(() => {
    // Most of the time it will be router.query.id
    // But if anything weird happens (IDs stuck together), we safely extract the first UUID.
    const fromQuery = extractUuid(router.query?.id);
    if (fromQuery) return fromQuery;

    // fallback: try extracting from the URL path
    const fromPath = extractUuid(router.asPath);
    return fromPath || null;
  }, [router.query?.id, router.asPath]);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [student, setStudent] = useState(null);
  const [series, setSeries] = useState([]);
  const [heatmap, setHeatmap] = useState(null);

  const [error, setError] = useState("");

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    window.location.href = "/teacher/login";
  }

  useEffect(() => {
    // must be logged in
    fetch("/api/teacher/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          window.location.href = "/teacher/login";
          return;
        }
        setMe(data.user);
      })
      .catch(() => {
        window.location.href = "/teacher/login";
      });
  }, []);

  useEffect(() => {
    async function loadAll() {
      setError("");
      setLoading(true);

      if (!pupilId) {
        setError("Missing pupil ID in URL.");
        setLoading(false);
        return;
      }

      try {
        // 1) Attainment graph data (your existing endpoint)
        const a = await fetch(`/api/teacher/attainment/student?student_id=${encodeURIComponent(pupilId)}`);
        const aj = await a.json();
        if (!aj.ok) {
          setError(aj.error || "Failed to load pupil attainment.");
          setLoading(false);
          return;
        }
        setStudent(aj.student || null);
        setSeries(aj.series || []);

        // 2) Heatmap (your endpoint we’ve been working on)
        const h = await fetch(`/api/teacher/pupil_heatmap?pupil_id=${encodeURIComponent(pupilId)}`);
        const hj = await h.json();
        if (!hj.ok) {
          // Heatmap failing should not block the whole page
          setHeatmap(null);
          setError(hj.error || "Heatmap failed to load.");
        } else {
          setHeatmap(hj);
        }

        setLoading(false);
      } catch (e) {
        setError(String(e));
        setLoading(false);
      }
    }

    loadAll();
  }, [pupilId]);

  const chartData = useMemo(() => {
    const labels = (series || []).map((p) => new Date(p.date).toLocaleDateString("en-GB"));
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

  if (!me) return null; // while redirecting

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Pupil Detail</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Logged in as <b>{me.email}</b> ({me.role})
          </p>
          <p style={{ marginTop: 4, opacity: 0.8 }}>
            <Link href="/teacher/class-overview">← Back to class overview</Link>{" "}
            • <Link href="/teacher">Back to dashboard</Link>
          </p>
        </div>

        <button onClick={logout} style={{ padding: "10px 14px", borderRadius: 10 }}>
          Log out
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#ffe5e5", color: "#9b1c1c" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 18, borderRadius: 16, background: "white" }}>
        <h2 style={{ marginTop: 0 }}>
          {student?.first_name ? `${student.first_name}${student?.last_name ? " " + student.last_name : ""}` : "Pupil"}
        </h2>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <div style={{ height: 320 }}>
              <Line data={chartData} />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, borderRadius: 16, background: "white" }}>
        <h2 style={{ marginTop: 0 }}>Times Tables Heatmap</h2>

        {!heatmap ? (
          <p style={{ opacity: 0.75 }}>
            No heatmap data yet (or it failed to load). Once the pupil has attempts, it will appear here.
          </p>
        ) : (
          <>
            <p style={{ opacity: 0.75, marginTop: 0 }}>
              Rows = tables • Columns = recent attempts • Colours: 100% light green • 90–99% green • 70–89% orange • &lt;70% red
            </p>

            {/* very basic rendering: you already have a nicer UI elsewhere;
                this is just to prove data is loading correctly */}
            <pre style={{ fontSize: 12, background: "#f6f6f6", padding: 12, borderRadius: 12, overflow: "auto" }}>
              {JSON.stringify(heatmap, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
