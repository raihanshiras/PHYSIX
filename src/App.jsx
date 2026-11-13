import {useCallback,useState} from "react";
import Camera from "./components/Camera";
import WaveLab from "./components/WaveLab";
import "./App.css";
export default function App(){
 const [palm,setPalm]=useState(null);
 const onPalmChange=useCallback(p=>setPalm(p),[]);
 return <main className="app-shell"><header className="app-header"><a className="brand" href="/" aria-label="PHYSIX home">PHYSIX<span className="brand-period">.</span></a><div className="header-label">INTERACTIVE PHYSICS LABORATORY</div></header><section className="intro"><p className="eyebrow">EXPERIMENT 01 / WAVE MECHANICS</p><h1>Shape the <span>invisible.</span></h1><p className="intro-copy">Explore a travelling wave in real time. Move your hand to change its amplitude and frequency, while the simulation keeps the wave physics connected.</p></section><div className="experiment-layout"><div className="experiment-main"><WaveLab palm={palm} cameraActive={Boolean(palm)}/></div><aside className="experiment-side"><div className="side-heading"><span>GESTURE INPUT</span><strong>01 / WEBCAM</strong></div><Camera onPalmChange={onPalmChange}/><div className="gesture-guide"><span>HOW TO INTERACT</span><p><b>Move hand left / right</b> to adjust frequency.</p><p><b>Move hand up / down</b> to adjust amplitude.</p><p className="gesture-muted">No camera? Use the experiment sliders instead.</p></div></aside></div><footer className="app-footer"><span>PHYSIX / LEARNING BUILD 01</span><span>WAVE SPEED · 2.0 M/S</span></footer></main>;
}