export function createPalmTracker({smoothingMs=42}={}) {
  let position=null,lastTime=0;
  function update(point,now=performance.now()) {
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)){reset();return null;}
    if(!position||now<=lastTime) position={x:point.x,y:point.y};
    else {
      const elapsed=Math.min(100,now-lastTime);
      const distance=Math.hypot(point.x-position.x,point.y-position.y);
      const adaptiveMs=distance>0.025?smoothingMs*0.62:smoothingMs*1.35;
      const alpha=1-Math.exp(-elapsed/Math.max(1,adaptiveMs));
      position={x:position.x+(point.x-position.x)*alpha,y:position.y+(point.y-position.y)*alpha};
    }
    lastTime=now;return {...position};
  }
  function reset(){position=null;lastTime=0;}
  return {update,reset};
}