// --- add near the top of the component (inside AttainmentIndividualClient) ---
const chartData = useMemo(() => {
  return {
    labels: series.map((s) => new Date(s.date).toLocaleDateString("en-GB")),
    datasets: [
      {
        label: "Score (%)",
        data: series.map((s) => s.score),

        // Make the line bold + visible
        borderWidth: 4,
        pointRadius: 3,
        pointHoverRadius: 7,
        tension: 0.35,

        // Nice filled area under the line
        fill: true,

        // Colors (feel free to change later)
        borderColor: "rgba(59, 130, 246, 1)",          // strong blue line
        backgroundColor: "rgba(59, 130, 246, 0.18)",   // soft blue fill
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      },
    ],
  };
}, [series]);

const chartOptions = useMemo(() => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    responsive: true,
    maintainAspectRatio: false,

    animation: prefersReducedMotion
      ? false
      : {
          duration: 900,
          easing: "easeOutQuart",
        },

    plugins: {
      legend: {
        display: true,
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          padding: 16,
        },
      },
      tooltip: {
        enabled: true,
        intersect: false,
        mode: "index",
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => `Score: ${ctx.parsed.y}%`,
        },
      },
    },

    interaction: {
      intersect: false,
      mode: "nearest",
    },

    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 10,
          callback: (v) => `${v}%`,
        },
        grid: {
          drawBorder: false,
        },
      },
    },

    elements: {
      line: { capBezierPoints: true },
    },
  };
}, []);
