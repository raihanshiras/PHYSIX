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
        <a className="brand" href="/" aria-label="PHYSIX home">PHYSIX<span className="brand-period">.</span></a>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#features">Experiments</a>
          <a href="#how-it-works">How it works</a>
          <a href="#laboratory">The lab</a>
          <a href="#about">About</a>
        </nav>
        <a className="header-cta" href="#laboratory">Enter the lab <span>↗</span></a>
      </header>

      <section className="intro">
        <div className="intro-copy-block">
          <p className="eyebrow"><span className="eyebrow-line" /> INTERACTIVE PHYSICS <span>·</span> EXPERIMENT 01</p>
          <h1>A more tangible<br /><span>way to learn physics.</span></h1>
          <p className="intro-copy">
            Explore the ideas behind motion, waves and energy. Change a variable,
            move your hand, and see the physics unfold.
          </p>
          <div className="intro-actions">
            <a className="primary-action" href="#laboratory">Explore the experiment <span>→</span></a>
            <a className="secondary-action" href="#how-it-works"><span>◉</span> See how it works</a>
          </div>
        </div>
        <div className="intro-index" aria-hidden="true"><strong>LEARN BY</strong><span>✳</span><strong>EXPLORING</strong></div>
      </section>

      <div className="section-rule" id="features"><span>THE INTERACTIVE LABORATORY</span><span>EXPERIMENT 01 / 01</span></div>
      <section className="experiment-layout" id="laboratory" aria-label="Wave mechanics experiment">
        <div className="experiment-main">
          <WaveLab palm={palm} cameraActive={cameraActive} />
        </div>
        <aside className="experiment-side">
          <div className="side-heading">
            <div><span className="side-kicker">INPUT SOURCE</span><strong>Gesture tracking</strong></div>
            <span className={cameraActive ? "connection-pill is-connected" : "connection-pill"}><i />{cameraActive ? "CONNECTED" : "STANDBY"}</span>
          </div>
          <Camera onPalmChange={onPalmChange} onCameraStatusChange={onCameraStatusChange} />
          <div className="gesture-guide" id="how-it-works">
            <div className="guide-heading"><span className="guide-icon">↗</span><span>HOW TO INTERACT</span></div>
            <div className="guide-row"><span className="guide-axis">X</span><p><b>Move left / right</b><small>Adjust wave frequency</small></p></div>
            <div className="guide-row"><span className="guide-axis">Y</span><p><b>Move up / down</b><small>Adjust wave amplitude</small></p></div>
            <p className="gesture-muted">Point your index finger to control the wave. Open palms and closed fists are ignored. Use the sliders for precise adjustments.</p>
          </div>
        </aside>
      </section>

      <footer className="app-footer" id="about">
        <span>PHYSIX <i /> AN INTERACTIVE LEARNING PROJECT</span>
        <span>WAVE SPEED <b>2.0 M/S</b></span>
      </footer>
    </main>
  );
}