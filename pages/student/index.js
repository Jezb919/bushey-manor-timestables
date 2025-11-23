import { useState } from "react";

export default function StudentLogin() {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    // For now, we just send them to the test page
    // Later we will connect this to Supabase.
    const encodedName = encodeURIComponent(name);
    const encodedClass = encodeURIComponent(className);

    window.location.href = `/student/tests?name=${encodedName}&class=${encodedClass}`;
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Student Login</h1>
      <p>Please enter your name and class:</p>

      <form onSubmit={handleSubmit} style={{ marginTop: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label>Name:</label><br/>
          <input
            type="text"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px", width: "250px" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>Class:</label><br/>
          <input
            type="text"
            value={className}
            required
            onChange={(e) => setClassName(e.target.value)}
            style={{ padding: "8px", width: "250px" }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "#0070f3",
            color: "white",
            borderRadius: "5px",
            border: "none",
            fontSize: "16px",
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
