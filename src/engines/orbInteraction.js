const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const length = (x, y) => Math.hypot(x, y);
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];
function closest(point, a, b) {
  const dx=b.x-a.x, dy=b.y-a.y, d=dx*dx+dy*dy;
  const t=d>1e-8?clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/d,0,1):0;
  return {x:a.x+dx*t,y:a.y+dy*t};
}
export function createOrbInteraction() {
  const orb={mode:"idle",x:0.5,y:0.5,vx:0,vy:0,radius:0.026,spin:0};
  let previousPalm=null, previousPalmTime=0, lastFrameTime=0;
  let velocity={x:0,y:0}, grabOffset={x:0,y:-0.12}, lastImpact=0, lostHandAt=0;
  function reset() {
    Object.assign(orb,{mode:"idle",x:0.5,y:0.5,vx:0,vy:0,spin:0});
    previousPalm=null; previousPalmTime=0; lastFrameTime=0;
    velocity={x:0,y:0}; grabOffset={x:0,y:-0.12}; lastImpact=0; lostHandAt=0;
  }
  function update({palm,landmarks=null,palmWidth=0.12,gesture="PARTIAL",now=performance.now(),palmTime=now}) {
    const dt=lastFrameTime?clamp((now-lastFrameTime)/1000,0,0.05):0;
    lastFrameTime=now;
    if(palm && palmTime!==previousPalmTime) {
      if(previousPalm && palmTime>previousPalmTime) {
        const sampleDt=clamp((palmTime-previousPalmTime)/1000,1/120,0.12);
        const raw={x:clamp((palm.x-previousPalm.x)/sampleDt,-3.2,3.2),y:clamp((palm.y-previousPalm.y)/sampleDt,-3.2,3.2)};
        if(length(raw.x,raw.y)<3.8) {
          const a=1-Math.exp(-sampleDt/0.075);
          velocity.x+=(raw.x-velocity.x)*a; velocity.y+=(raw.y-velocity.y)*a;
        }
      } else velocity={x:0,y:0};
      previousPalm={x:palm.x,y:palm.y}; previousPalmTime=palmTime; lostHandAt=0;
    } else if(!palm && !lostHandAt) lostHandAt=now;

    if(orb.mode==="idle" && palm) {
      orb.x=clamp(palm.x+grabOffset.x,orb.radius,1-orb.radius);
      orb.y=clamp(palm.y+grabOffset.y,orb.radius,1-orb.radius);
      if(gesture==="CLOSED") { orb.mode="grabbed"; grabOffset={x:orb.x-palm.x,y:orb.y-palm.y}; velocity={x:0,y:0}; }
    } else if(orb.mode==="grabbed") {
      if(!palm || (lostHandAt && now-lostHandAt>180)) { orb.mode="falling"; orb.vx=0; orb.vy=0; }
      else {
        orb.x=clamp(palm.x+grabOffset.x,orb.radius,1-orb.radius);
        orb.y=clamp(palm.y+grabOffset.y,orb.radius,1-orb.radius);
        if(gesture==="OPEN") {
          orb.mode="falling";
          orb.vx=clamp(velocity.x*0.92,-1.8,1.8);
          orb.vy=clamp(velocity.y*0.92,-1.8,1.8);
          lastImpact=now;
        }
      }
    } else {
      integrate(dt);
      if(palm && landmarks?.length===21) collideWithHand(landmarks,palmWidth,velocity,now);
    }
    return {...orb};
  }
  function integrate(dt) {
    if(dt<=0)return;
    const count=Math.max(1,Math.ceil(dt/(1/120))), step=dt/count;
    for(let i=0;i<count;i++) {
      orb.vy+=1.05*step; orb.x+=orb.vx*step; orb.y+=orb.vy*step;
      const drag=Math.exp(-0.16*step); orb.vx*=drag; orb.vy*=drag; orb.spin+=orb.vx*step*2.8;
      if(orb.x<orb.radius){orb.x=orb.radius;orb.vx=Math.abs(orb.vx)*0.78;}
      if(orb.x>1-orb.radius){orb.x=1-orb.radius;orb.vx=-Math.abs(orb.vx)*0.78;}
      if(orb.y<orb.radius){orb.y=orb.radius;orb.vy=Math.abs(orb.vy)*0.72;}
      if(orb.y>1-orb.radius){orb.y=1-orb.radius;orb.vy=-Math.abs(orb.vy)*0.76;if(Math.abs(orb.vy)<0.08)orb.vy=0;}
    }
  }
  function collideWithHand(points,palmWidth,handVelocity,now) {
    const fingerRadius=Math.max(0.006,palmWidth*0.105);
    let best=null;
    for(const [i,j] of BONES) {
      const p=closest(orb,points[i],points[j]);
      const dx=orb.x-p.x,dy=orb.y-p.y,d=length(dx,dy);
      if(!best||d<best.distance)best={dx,dy,distance:d,core:false};
    }
    const center=[0,5,9,13,17].reduce((s,i)=>({x:s.x+points[i].x/5,y:s.y+points[i].y/5}),{x:0,y:0});
    const pdx=orb.x-center.x,pdy=orb.y-center.y,pd=length(pdx,pdy),coreRadius=palmWidth*0.43;
    if(!best||pd-coreRadius<best.distance-fingerRadius)best={dx:pdx,dy:pdy,distance:Math.max(0,pd-coreRadius),core:true};
    const collisionDistance=orb.radius+(best.core?0:fingerRadius);
    if(best.distance>=collisionDistance)return;
    let nx=best.dx,ny=best.dy,n=length(nx,ny);
    if(n<1e-5){const speed=length(handVelocity.x,handVelocity.y);nx=speed>0.08?-handVelocity.x/speed:0;ny=speed>0.08?-handVelocity.y/speed:-1;}
    else {nx/=n;ny/=n;}
    const penetration=collisionDistance-best.distance;
    orb.x+=nx*penetration;orb.y+=ny*penetration;
    const relative=(orb.vx-handVelocity.x)*nx+(orb.vy-handVelocity.y)*ny;
    if(relative<0&&now-lastImpact>65) {
      const impulse=-(1+0.42)*relative;
      orb.vx+=nx*impulse;orb.vy+=ny*impulse;
      const tx=-ny,ty=nx,tangent=handVelocity.x*tx+handVelocity.y*ty;
      orb.vx+=tx*tangent*0.22;orb.vy+=ty*tangent*0.22;
      orb.vx=clamp(orb.vx,-2.5,2.5);orb.vy=clamp(orb.vy,-2.5,2.5);lastImpact=now;
    }
    orb.x=clamp(orb.x,orb.radius,1-orb.radius);orb.y=clamp(orb.y,orb.radius,1-orb.radius);
  }
  return {update,reset};
}