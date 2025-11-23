export default function TestsPage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>Select Your Test</h1>
      <p>Choose which times table to practise:</p>

      <ul style={{ marginTop: "1rem", fontSize: "18px" }}>
        <li><a href="/student/tests/2">2 Times Table</a></li>
        <li><a href="/student/tests/3">3 Times Table</a></li>
        <li><a href="/student/tests/4">4 Times Table</a></li>
        <li><a href="/student/tests/5">5 Times Table</a></li>
        <li><a href="/student/tests/6">6 Times Table</a></li>
        <li><a href="/student/tests/7">7 Times Table</a></li>
        <li><a href="/student/tests/8">8 Times Table</a></li>
        <li><a href="/student/tests/9">9 Times Table</a></li>
        <li><a href="/student/tests/10">10 Times Table</a></li>
      </ul>
    </div>
  );
}
