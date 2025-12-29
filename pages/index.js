// pages/index.js
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  return (
    <div className="page">
      {/* soft glow background */}
      <div className="bg" />

      <main className="wrap">
        <section className="card">
          <h1 className="title">Bushey Manor Times Tables</h1>
          <p className="subtitle">Choose your mode</p>

          <div className="buttons">
            <button
              className="btn btnStudent"
              onClick={() => router.push("/student/login")}
            >
              Student
            </button>

            <button
              className="btn btnTeacher"
              onClick={() => router.push("/teacher/login")}
            >
              Teacher
            </button>
          </div>
        </section>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: grid;
          place-items: center;
          background: #06080f;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }

        .bg {
          position: absolute;
          inset: -20%;
          background: radial-gradient(
              circle at 30% 15%,
              rgba(255, 204, 0, 0.55),
              rgba(255, 204, 0, 0) 55%
            ),
            radial-gradient(
              circle at 75% 35%,
              rgba(25, 95, 255, 0.35),
              rgba(25, 95, 255, 0) 55%
            ),
            radial-gradient(
              circle at 60% 85%,
              rgba(0, 255, 180, 0.12),
              rgba(0, 255, 180, 0) 55%
            );
          filter: blur(30px);
          transform: scale(1.05);
        }

        .wrap {
          position: relative;
          width: min(820px, 92vw);
          padding: 40px 0;
          z-index: 1;
        }

        .card {
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 56px 48px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(10px);
        }

        .title {
          margin: 0 0 10px 0;
          font-size: clamp(34px, 4.2vw, 54px);
          font-weight: 800;
          letter-spacing: 0.2px;
          color: #ffcc00;
          text-shadow: 0 6px 30px rgba(255, 204, 0, 0.18);
        }

        .subtitle {
          margin: 0 0 34px 0;
          font-size: 18px;
          color: rgba(255, 255, 255, 0.85);
        }

        .buttons {
          display: flex;
          gap: 18px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          appearance: none;
          border: none;
          cursor: pointer;
          padding: 14px 34px;
          border-radius: 999px;
          font-size: 18px;
          font-weight: 800;
          transition: transform 0.08s ease, filter 0.08s ease,
            box-shadow 0.08s ease, background 0.08s ease;
          min-width: 170px;
        }

        .btn:active {
          transform: translateY(1px) scale(0.99);
        }

        .btnStudent {
          background: #ffcc00;
          color: #111;
          box-shadow: 0 10px 28px rgba(255, 204, 0, 0.22);
        }

        .btnStudent:hover {
          filter: brightness(1.03);
        }

        .btnTeacher {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
        }

        .btnTeacher:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        @media (max-width: 520px) {
          .card {
            padding: 42px 22px;
          }
          .btn {
            width: 100%;
            min-width: unset;
          }
        }
      `}</style>
    </div>
  );
}
