import { useEffect, useState } from "react";
import Link from "next/link";

export default function ClassSettingsPage() {
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classLabel, setClassLabel] = useState("");
  const [loading, setLoading] = useState(true);

  const [questionCount, setQuestionCount] = useState(25);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(6);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setErr("");
      setMsg("");

      // Who am I?
      const meRes = await fetch("/api/teacher/me");
      const meJson = await meRes.json();
      if (!meJson?.ok) {
        window.location.href = "/teacher/login";
        return;
      }
      setMe(meJson.user);

      // Admin gets class list; teacher doesn't need it
      if (meJson.user.role === "admin") {
        const cRes = await fetch("/api/teacher/classes");
        const cJson = await cRes.json();
        if (cJson?.ok) {
          setClasses(cJson.classes || []);
          if ((cJson.classes || []).length) setClassLabel(cJson.classes[0].class_label);
        }
      }

      setLoading(false);
    }
    boot();
  }, []);

  // Load settings when class changes (admin) OR on first load (teacher)
  useEffect(() => {
    async function loadSettings() {
      if (!me) return;

      setErr("");
      setMsg("");

      const url =
        me.role === "admin"
          ? `/api/teacher/class_settings?class_label=${encodeURIComponent(classLabel || "")}`
          : "/api/teacher/class_settings";

      const r = await fetch(url);
      const j = await r.json();
      if (!j?.ok) {
        setErr(j?.error || "Failed to load");
        return;
      }

      setQuestionCount(j.settings?.question_count ?? 25);
      setSecondsPerQuestion(j.settings?.seconds_per_question ?? 6);

      // For teacher, show their class label
      if (me.role !== "admin") setClassLabel(j.class_label || "");
    }

    // Admin: wait for classLabel to be set
    if (me?.role === "admin" && !classLabel) return;

    loadSettings();
  }, [me, classLabel]);

  async function save() {
    setErr("");
    setMsg("");

    const url =
      me.role === "admin"
        ? "/api/teacher/class_settings"
        : "/api/teacher/class_settings";

    const body = {
      class_label: me.role === "admin" ? classLabel : undefined,
      question_count: Number(questionCount),
      seconds_per_question: Number(secondsPerQuestion),
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j?.ok) {
      setErr(j?.error || "Save failed");
      return;
    }
    setMsg("Saved ✅");
  }

  if (loading) return <div style={{ padding: 30 }}>Loading…</div>;

  return (
    <div style={{ padding: 30, maxWidth: 800 }}>
      <h1>Class test settings</h1>

      <p>
        <Link href="/teacher">← Back to dashboard</Link>
      </p>

      {me?.role === "admin" ? (
        <div style={{ marginBottom: 14 }}>
          <label>
            Class:&nbsp;
            <select
              value={classLabel}
              onChange={(e) => setClassLabel(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.class_label}>
                  {c.class_label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p>
          Class: <b>{classLabel || "—"}</b>
        </p>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Number of questions (10–60):&nbsp;
            <input
              type="number"
              min="10"
              max="60"
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              style={{ width: 90 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Seconds per question:&nbsp;
            <select
              value={secondsPerQuestion}
              onChange={(e) => setSecondsPerQuestion(Number(e.target.value))}
            >
              <option value={3}>3s</option>
              <option value={6}>6s</option>
              <option value={9}>9s</option>
              <option value={12}>12s</option>
            </select>
          </label>
        </div>

        <button onClick={save} style={{ padding: "10px 16px" }}>
          Save settings
        </button>

        {msg && <p style={{ color: "green" }}>{msg}</p>}
        {err && <p style={{ color: "red" }}>{err}</p>}
      </div>
    </div>
  );
}
