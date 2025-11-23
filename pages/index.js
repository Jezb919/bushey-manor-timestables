export default function Home() {
  return (
    <div style={{ padding: "40px", fontSize: "24px" }}>
      <h1>Bushey Manor Times Tables</h1>
      <p>Select Student or Teacher:</p>
      <ul>
        <li><a href="/student">Student Portal</a></li>
        <li><a href="/teacher">Teacher Portal</a></li>
      </ul>
    </div>
  );
}
