import { useCallback, useState } from "react";
import Camera from "./components/Camera";
import WaveLab from "./components/WaveLab";
import "./App.css";

export default function App() {
  const [palm, setPalm] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const onPalmChange = useCallback((point) => setPalm(point), []);
  const onCameraStatusChange = useCallback((active) => setCameraActive(active), []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="PHYSIX home">
          <span className="brand-mark">P</span>
          <span>PHYSIX<span className="brand-period">.</span></span>
        </a>
        <div className="header-meta">
          <span className="header-label">INTERACTIVE PHYSICS LABORATORY</span>
          <span className="header-version">BROWSER EXPERIMENTS <i /> 01</span>
        </div>
      </header>

      <section className="intro">
        <div className="intro-copy-block">
          <p className="eyebrow"><span className="eyebrow-line" /> EXPERIMENT 01 <span>/</span> WAVE MECHANICS</p>
          <h1>Make the invisible<br /><span>move.</span></h1>
          <p className="intro-copy">
            Explore a travelling wave with your hands. Change its amplitude and frequency,
            then watch the physics respond in real time.
          </p>
        </div>
        <div className="intro-index" aria-hidden="true">
          <span>PHYSICS / 001</span>
          <strong>WAVE<br />MOTION</strong>
          <span>INTERACTIVE STUDY</span>
        </div>
      </section>

      <div className="section-rule"><span>THE LABORATORY</span><span>01 — 02</span></div>
      <section className="experiment-layout" aria-label="Wave mechanics experiment">
        <div className="experiment-main">
          <WaveLab palm={palm} cameraActive={cameraActive} />
        </div>
        <aside className="experiment-side">
          <div className="side-heading">
            <div><span className="side-kicker">INPUT SOURCE</span><strong>Gesture tracking</strong></div>
            <span className={cameraActive ? "connection-pill is-connected" : "connection-pill"}><i />{cameraActive ? "CONNECTED" : "STANDBY"}</span>
          </div>
          <Camera onPalmChange={onPalmChange} onCameraStatusChange={onCameraStatusChange} />
          <div className="gesture-guide">
            <div className="guide-heading"><span className="guide-icon">↗</span><span>HOW TO INTERACT</span></div>
            <div className="guide-row"><span className="guide-axis">X</span><p><b>Move left / right</b><small>Adjust wave frequency</small></p></div>
            <div className="guide-row"><span className="guide-axis">Y</span><p><b>Move up / down</b><small>Adjust wave amplitude</small></p></div>
            <p className="gesture-muted">Move in one direction at a time. You can always use the sliders for precise control.</p>
          </div>
        </aside>
      </section>

      <footer className="app-footer">
        <span>PHYSIX <i /> AN INTERACTIVE LEARNING PROJECT</span>
        <span>WAVE SPEED <b>2.0 M/S</b></span>
      </footer>
    </main>
  );
}
