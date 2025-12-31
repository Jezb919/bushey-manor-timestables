import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function StudentTestsHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const sRes = await fetch("/api/student/session");
        const sJson = await sRes.json();

        if (!sJson?.signedIn) {
          if (mounted) {
            setLoading(false);
            setSession(null);
            setSettings(null);
          }
          return;
        }

        const setRes = await fetch("/api/student/settings");
        const setJson = await setRes.json();

        if (mounted) {
          setSession(sJson.session || null);
          setSettings(setJson.settings || null);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError("Failed to load test info.");
          setLoading(false);
        }
      }
    }

    load();
    return () => (mounted = false);
  }, []);

  const availability = useMemo(() => {
    if (!settings?.test_start_date) return { ok: true, reason: "" };
    const start = new Date(settings.test_start_date);
    if (Number.isNaN(start.getTime())) return { ok: true, reason: "" };
    const now = new Date();
    if (now < start) {
      return { ok: false, reason: "Test not available yet (check class settings or start date)." };
    }
    return { ok: true, reason: "" };
  }, [settings]);

  const minT = settings?.minimum_table ?? "?";
  const maxT = settings?.maximum_table ?? "?";
  const classLabel = settings?.class_label || session?.class_label || "?";

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Maths Test</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Maths Test</h1>
        <p>You are not signed in.</p>
        <p>
          <Link href="/student/login">Go to Student Login</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 56, marginBottom: 10 }}>Maths Test</h1>
      <p style={{ fontSize: 18, marginTop: 0 }}>
        This test includes <b>mixed times tables</b>.
      </p>

      {!!error && (
        <div style={{ background: "#ffe6e6", padding: 12, borderRadius: 10, marginTop: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 18 }}>
        <div>
          <b>Class:</b> {classLabel}
        </div>
        <div>
          <b>Tables:</b> {minT} to {maxT}
        </div>
      </div>

      {!availability.ok && (
        <div style={{ marginTop: 16, color: "darkred", fontSize: 18 }}>
          {availability.reason}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <button
          onClick={() => router.push("/student/tests/mixed")}
          disabled={!availability.ok}
          style={{
            fontSize: 20,
            padding: "14px 28px",
            borderRadius: 12,
            border: "none",
            cursor: availability.ok ? "pointer" : "not-allowed",
            opacity: availability.ok ? 1 : 0.5,
          }}
        >
          START TEST
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/student/login">Back to Student Login</Link>
      </div>
    </div>
  );
}
