import {useEffect,useRef,useState} from "react";
import "./WaveLab.css";
const SPEED=2,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const LOCK_THRESHOLD=.025,DOMINANCE=1.35,RELEASE_AFTER=320,MOTION_EPSILON=.0018;
export default function WaveLab({palm,cameraActive}){
 const canvas=useRef(null),params=useRef({amplitude:.55,frequency:1.25}),gesture=useRef({last:null,origin:null,lock:null,lastMotion:0});
 const [amplitude,setAmplitude]=useState(.55),[frequency,setFrequency]=useState(1.25),[handControl,setHandControl]=useState(true),[time,setTime]=useState(0),[activeAxis,setActiveAxis]=useState(null);
 useEffect(()=>{
  const g=gesture.current;
  if(!cameraActive||!palm||!handControl){g.last=null;g.origin=null;g.lock=null;g.lastMotion=0;setActiveAxis(null);return;}
  const point={x:palm.x,y:palm.y},now=performance.now();
  if(!g.last){g.last=point;g.origin={...point,amplitude,frequency};return;}
  const dx=point.x-g.last.x,dy=point.y-g.last.y;
  if(Math.hypot(dx,dy)>MOTION_EPSILON)g.lastMotion=now;
  g.last=point;
  if(g.lock&&now-g.lastMotion>RELEASE_AFTER){g.lock=null;g.origin={...point,amplitude:params.current.amplitude,frequency:params.current.frequency};setActiveAxis(null);return;}
  if(!g.lock){
   const fromX=point.x-g.origin.x,fromY=point.y-g.origin.y,ax=Math.abs(fromX),ay=Math.abs(fromY);
   if(Math.max(ax,ay)>=LOCK_THRESHOLD){
    if(ax>ay*DOMINANCE)g.lock="x";
    else if(ay>ax*DOMINANCE)g.lock="y";
    if(g.lock){g.origin={...point,amplitude:params.current.amplitude,frequency:params.current.frequency};g.lastMotion=now;setActiveAxis(g.lock);}
   }
   return;
  }
  if(g.lock==="x"){
   const next=clamp(g.origin.frequency+(point.x-g.origin.x)*-10,.5,2.5);
   setFrequency(next);
  }else{
   const next=clamp(g.origin.amplitude+(point.y-g.origin.y)*-4,.1,.9);
   setAmplitude(next);
  }
 },[palm,cameraActive,handControl]);
 useEffect(()=>{params.current={amplitude,frequency};},[amplitude,frequency]);
 useEffect(()=>{let raf,start=0,lastUi=0;const draw=now=>{if(!start)start=now;const t=(now-start)/1000,c=canvas.current;if(c){const d=window.devicePixelRatio||1,w=Math.max(1,Math.round(c.clientWidth*d)),h=Math.max(1,Math.round(c.clientHeight*d));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}const x=c.getContext("2d");x.setTransform(d,0,0,d,0,0);const W=c.clientWidth,H=c.clientHeight,p=params.current,lambda=SPEED/p.frequency,k=2*Math.PI/lambda,omega=2*Math.PI*p.frequency,cy=H*.52,scale=Math.min(H*.34/.9,W/4);x.clearRect(0,0,W,H);x.fillStyle="#0c141b";x.fillRect(0,0,W,H);x.strokeStyle="rgba(155,180,193,.12)";x.lineWidth=1;for(let xx=0;xx<=W;xx+=40){x.beginPath();x.moveTo(xx,0);x.lineTo(xx,H);x.stroke();}for(let yy=0;yy<=H;yy+=32){x.beginPath();x.moveTo(0,yy);x.lineTo(W,yy);x.stroke();}x.strokeStyle="rgba(203,220,229,.42)";x.beginPath();x.moveTo(0,cy);x.lineTo(W,cy);x.stroke();x.setLineDash([4,6]);x.strokeStyle="rgba(203,220,229,.25)";[cy-p.amplitude*scale,cy+p.amplitude*scale].forEach(y=>{x.beginPath();x.moveTo(0,y);x.lineTo(W,y);x.stroke();});x.setLineDash([]);x.beginPath();for(let xx=0;xx<=W;xx+=2){const metres=xx/W*4,y=cy-p.amplitude*Math.sin(k*metres-omega*t)*scale;if(xx===0)x.moveTo(xx,y);else x.lineTo(xx,y);}x.strokeStyle="#78e5c0";x.lineWidth=2.8;x.shadowColor="#78e5c0";x.shadowBlur=14;x.stroke();x.shadowBlur=0;x.fillStyle="#91a5b1";x.font="10px ui-monospace,monospace";x.fillText("DISPLACEMENT",14,18);x.fillText("DISTANCE →",W-92,H-12);if(now-lastUi>250){lastUi=now;setTime(t);}}raf=requestAnimationFrame(draw);};raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);},[]);
 const wavelength=SPEED/frequency,omega=2*Math.PI*frequency,k=2*Math.PI/wavelength;
 return <section className="wave-lab"><div className="wave-heading"><div><span className="wave-kicker">LIVE PHYSICS SIMULATION</span><h2>Travelling wave</h2></div><span className="simulation-live"><i/> SIMULATION RUNNING</span></div><canvas ref={canvas} className="wave-canvas" aria-label="Animated travelling sine wave graph"/><div className="wave-readouts"><div><span>AMPLITUDE</span><strong>{amplitude.toFixed(2)} <small>m</small></strong></div><div><span>FREQUENCY</span><strong>{frequency.toFixed(2)} <small>Hz</small></strong></div><div><span>WAVELENGTH</span><strong>{wavelength.toFixed(2)} <small>m</small></strong></div><div><span>WAVE SPEED</span><strong>2.0 <small>m/s</small></strong></div></div><div className="wave-controls"><div className="control-title"><span>EXPERIMENT CONTROLS</span><label className="hand-control"><input type="checkbox" checked={handControl} onChange={e=>{setHandControl(e.target.checked);gesture.current={last:null,origin:null,lock:null,lastMotion:0};setActiveAxis(null);}}/> HAND CONTROL {cameraActive?(activeAxis?activeAxis==="x"?"· FREQUENCY LOCKED":"· AMPLITUDE LOCKED":palm?"· MOVE TO SELECT AXIS":"· SHOW HAND"):"· CAMERA OFF"}</label></div><label className="wave-slider"><span>Amplitude <b>{amplitude.toFixed(2)} m</b></span><input type="range" min=".1" max=".9" step=".01" value={amplitude} onChange={e=>setAmplitude(Number(e.target.value))}/></label><label className="wave-slider"><span>Frequency <b>{frequency.toFixed(2)} Hz</b></span><input type="range" min=".5" max="2.5" step=".01" value={frequency} onChange={e=>setFrequency(Number(e.target.value))}/></label></div><div className="equation-panel"><div><span>TRAVELLING WAVE EQUATION</span><code>y(x,t) = A sin(kx − ωt)</code></div><div className="equation-values"><span>k = {k.toFixed(2)} rad/m</span><span>ω = {omega.toFixed(2)} rad/s</span><span>t = {time.toFixed(1)} s</span></div></div><p className="wave-note">Move decisively in one direction to select a control axis. The other parameter stays fixed until your hand returns to rest. Wave speed is fixed at 2.0 m/s, so wavelength follows v = fλ.</p></section>;
}