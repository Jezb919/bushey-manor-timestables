// pages/student/tests/index.js
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function StudentTestsHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // 1) session
      const sResp = await fetch("/api/student/session");
      const sData = await sResp.json().catch(() => null);

      if (!sData?.signedIn) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      setSignedIn(true);

      // 2) class settings
      const setResp = await fetch("/api/student/settings");
      const setData = await setResp.json().catch(() => null);

      if (!setData?.ok || !setData?.signedIn) {
        setError(setData?.error || "Could not load class settings");
        setLoading(false);
        return;
      }

      setSettings(setData.settings || null);
      setLoading(false);
    })();
  }, []);

  function canStartTest() {
    if (!settings) return false;
    if (!settings.minimum_table || !settings.maximum_table) return false;

    // optional: enforce test_start_date if present
    if (settings.test_start_date) {
      const start = new Date(settings.test_start_date);
      // if the date string is invalid, ignore it
      if (!Number.isNaN(start.getTime())) {
        const now = new Date();
        // compare dates by time
        if (now < start) return false;
      }
    }
    return true;
  }

  function startTest() {
    router.push("/student/tests/mixed");
  }

  return (
    <div style={{ maxWidth: 900, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 54, margin: 0 }}>Maths Test</h1>
      <p style={{ fontSize: 18, marginTop: 10 }}>This test includes mixed times tables.</p>

      {loading && <p style={{ marginTop: 18 }}>Loading…</p>}

      {!loading && !signedIn && (
        <div style={{ marginTop: 18 }}>
          <div style={{ background: "#fde2e2", border: "1px solid #f5b5b5", padding: 14, borderRadius: 10 }}>
            You are not logged in. Please log in first.
          </div>
          <div style={{ marginTop: 12 }}>
            <Link href="/student/login">Go to Student Login</Link>
          </div>
        </div>
      )}

      {!loading && signedIn && (
        <div style={{ marginTop: 18 }}>
          {error && (
            <div style={{ background: "#fde2e2", border: "1px solid #f5b5b5", padding: 14, borderRadius: 10 }}>
              {error}
            </div>
          )}

          {settings && (
            <div style={{ marginTop: 14, fontSize: 16 }}>
              <div>
                <b>Class:</b> {settings.class_label || "(unknown)"}
              </div>
              <div>
                <b>Tables:</b> {settings.minimum_table ?? "?"} to {settings.maximum_table ?? "?"}
              </div>
              {settings.test_start_date && (
                <div>
                  <b>Test start date:</b> {String(settings.test_start_date)}
                </div>
              )}
            </div>
          )}

          {!canStartTest() && (
            <div style={{ marginTop: 16, color: "#b42318" }}>
              Test not available yet (check class settings or start date).
            </div>
          )}

          <button
            onClick={startTest}
            disabled={!canStartTest()}
            style={{
              marginTop: 18,
              fontSize: 18,
              padding: "14px 22px",
              borderRadius: 12,
              border: "none",
              background: canStartTest() ? "#3b4658" : "#9aa4b2",
              color: "white",
              cursor: canStartTest() ? "pointer" : "not-allowed",
              minWidth: 220,
            }}
          >
            START TEST
          </button>

          <div style={{ marginTop: 14 }}>
            <Link href="/student/login">Back to Student Login</Link>
          </div>
        </div>
      )}
    </div>
  );
}
