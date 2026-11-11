const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const length = (x, y) => Math.hypot(x, y);

export function createOrbInteraction() {
  const orb = { mode: "idle", x: 0.5, y: 0.5, vx: 0, vy: 0, radius: 0.026, spin: 0 };
  let previousPalm = null;
  let previousPalmTime = 0;
  let lastFrameTime = 0;
  let palmVelocity = { x: 0, y: 0 };

  function reset() {
    Object.assign(orb, { mode: "idle", x: 0.5, y: 0.5, vx: 0, vy: 0, spin: 0 });
    previousPalm = null;
    previousPalmTime = 0;
    lastFrameTime = 0;
    palmVelocity = { x: 0, y: 0 };
  }

  // Call on every display frame. palmTime changes only when a fresh vision
  // result arrives, so hand velocity is not incorrectly zeroed between frames.
  function update({ palm, palmWidth = 0.12, gesture = "PARTIAL", now = performance.now(), palmTime = now }) {
    const dt = lastFrameTime ? clamp((now - lastFrameTime) / 1000, 0, 1 / 30) : 0;
    lastFrameTime = now;

    const priorPalm = previousPalm ? { ...previousPalm } : null;
    if (palm && palmTime !== previousPalmTime) {
      if (previousPalm && previousPalmTime && palmTime > previousPalmTime) {
        const sampleDt = (palmTime - previousPalmTime) / 1000;
        palmVelocity = {
          x: clamp((palm.x - previousPalm.x) / sampleDt, -3.5, 3.5),
          y: clamp((palm.y - previousPalm.y) / sampleDt, -3.5, 3.5),
        };
      } else {
        palmVelocity = { x: 0, y: 0 };
      }
      previousPalm = { x: palm.x, y: palm.y };
      previousPalmTime = palmTime;
    } else if (!palm) {
      previousPalm = null;
      previousPalmTime = 0;
      palmVelocity = { x: 0, y: 0 };
    }

    if (orb.mode === "idle") {
      if (palm) {
        orb.x = palm.x;
        orb.y = palm.y - palmWidth * 0.9;
        if (gesture === "CLOSED") orb.mode = "grabbed";
      }
    } else if (orb.mode === "grabbed") {
      if (!palm) {
        orb.mode = "falling";
        orb.vx = 0;
        orb.vy = 0;
      } else {
        orb.x = palm.x;
        orb.y = palm.y - palmWidth * 0.9;
        if (gesture === "OPEN") {
          orb.mode = "falling";
          orb.vx = palmVelocity.x * 0.78;
          orb.vy = palmVelocity.y * 0.78;
        }
      }
    } else {
      integrate(dt);
      if (palm) collideWithPalm(palm, Math.max(0.045, palmWidth * 0.72), palmVelocity, dt, priorPalm);
      if (palm && gesture === "CLOSED" && length(orb.x - palm.x, orb.y - (palm.y - palmWidth * 0.9)) < 0.2) {
        orb.mode = "grabbed";
        orb.x = palm.x;
        orb.y = palm.y - palmWidth * 0.9;
        orb.vx = 0;
        orb.vy = 0;
      }
    }
    return { ...orb };
  }

  function integrate(dt) {
    if (dt <= 0) return;
    const gravity = 1.45;
    orb.vy += gravity * dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    const drag = Math.exp(-0.10 * dt);
    orb.vx *= drag;
    orb.vy *= drag;
    orb.spin += orb.vx * dt * 3;

    if (orb.x < orb.radius) {
      orb.x = orb.radius;
      orb.vx = Math.abs(orb.vx) * 0.78;
    } else if (orb.x > 1 - orb.radius) {
      orb.x = 1 - orb.radius;
      orb.vx = -Math.abs(orb.vx) * 0.78;
    }
    if (orb.y < orb.radius) {
      orb.y = orb.radius;
      orb.vy = Math.abs(orb.vy) * 0.72;
    } else if (orb.y > 1 - orb.radius) {
      orb.y = 1 - orb.radius;
      orb.vy = -Math.abs(orb.vy) * 0.78;
      if (Math.abs(orb.vy) < 0.10) orb.vy = 0;
    }
  }

  // Swept palm collision: test the orb against the segment travelled by the
  // palm since the last vision sample, not just a single instantaneous point.
  function collideWithPalm(palm, palmRadius, velocity, dt, priorPalm) {
    const start = priorPalm ?? palm;
    const dx = palm.x - start.x;
    const dy = palm.y - start.y;
    const segmentLengthSq = dx * dx + dy * dy;
    const t = segmentLengthSq > 1e-8
      ? clamp(((orb.x - start.x) * dx + (orb.y - start.y) * dy) / segmentLengthSq, 0, 1)
      : 1;
    const closestX = start.x + dx * t;
    const closestY = start.y + dy * t;
    let nx = orb.x - closestX;
    let ny = orb.y - closestY;
    let separation = length(nx, ny);
    const minDistance = palmRadius + orb.radius;
    if (separation >= minDistance) return;
    if (separation < 1e-5) {
      const speed = length(velocity.x, velocity.y) || 1;
      nx = -velocity.x / speed;
      ny = -velocity.y / speed;
      separation = 1e-5;
    } else {
      nx /= separation;
      ny /= separation;
    }

    orb.x = closestX + nx * minDistance;
    orb.y = closestY + ny * minDistance;
    const relativeNormalSpeed = (orb.vx - velocity.x) * nx + (orb.vy - velocity.y) * ny;
    if (relativeNormalSpeed < 0) {
      const impulse = -(1 + 0.88) * relativeNormalSpeed;
      orb.vx += impulse * nx;
      orb.vy += impulse * ny;
    }
    // A fast swipe contributes energy even when frame sampling catches the
    // overlap just after the palm has passed the orb.
    const swipe = velocity.x * nx + velocity.y * ny;
    if (swipe < -0.08) {
      const transfer = Math.min(2.8, -swipe * 0.9);
      orb.vx += -nx * transfer;
      orb.vy += -ny * transfer;
    }
  }

  return { update, reset };
}
