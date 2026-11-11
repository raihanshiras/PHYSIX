import Camera from "./components/Camera";
import "./App.css";

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="PHYSIX home">
          PHYSIX<span className="brand-period">.</span>
        </a>
        <div className="header-label">INTERACTIVE REALITY LABORATORY</div>
      </header>
      <section className="intro">
        <p className="eyebrow">EXPERIMENT 01 / CAMERA FOUNDATION</p>
        <h1>Start with <span>reality.</span></h1>
        <p className="intro-copy">
          First, establish a reliable connection between the browser and the
          physical world. Hand tracking comes next.
        </p>
      </section>
      <Camera />
      <footer className="app-footer">
        <span>PHYSIX LEARNING BUILD</span>
        <span>01A — WEBCAM ACCESS</span>
      </footer>
    </main>
  );
}
