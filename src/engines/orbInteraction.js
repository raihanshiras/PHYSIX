const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A single screen-space orb with grab/release, gravity, viewport impacts,
 * and a moving-palm collision response. All positions are normalized 0..1.
 */
export function createOrbInteraction() {
  const orb = {
    mode: "idle",
    x: 0.5,
    y: 0.5,
    vx: 0,
    vy: 0,
    radius: 0.026,
    spin: 0,
  };
  let previousPalm = null;
  let lastTime = 0;
  let lastGesture = "PARTIAL";

  function reset() {
    orb.mode = "idle";
    orb.x = 0.5;
    orb.y = 0.5;
    orb.vx = 0;
    orb.vy = 0;
    orb.spin = 0;
    previousPalm = null;
    lastTime = 0;
    lastGesture = "PARTIAL";
  }

  function update({ palm, palmWidth = 0.12, gesture = "PARTIAL", now = performance.now() }) {
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, 0.05) : 0;
    lastTime = now;

    const palmVelocity = previousPalm && dt > 0
      ? { x: (palm.x - previousPalm.x) / dt, y: (palm.y - previousPalm.y) / dt }
      : { x: 0, y: 0 };

    if (!palm) {
      if (orb.mode === "idle" || orb.mode === "grabbed") {
        orb.mode = "falling";
        orb.vx = 0;
        orb.vy = 0;
      }
      previousPalm = null;
      stepPhysics(dt, null, 0, { x: 0, y: 0 });
      return snapshot();
    }

    if (orb.mode === "idle") {
      orb.x = palm.x;
      orb.y = palm.y - palmWidth * 0.9;
      orb.vx = 0;
      orb.vy = 0;
      if (gesture === "CLOSED") {
        orb.mode = "grabbed";
        orb.x = palm.x;
        orb.y = palm.y - palmWidth * 0.9;
      }
    } else if (orb.mode === "grabbed") {
      orb.x = palm.x;
      orb.y = palm.y - palmWidth * 0.9;
      if (gesture === "OPEN") {
        orb.mode = "falling";
        // Inherit hand velocity on release; this gives a deliberate throw.
        orb.vx = clamp(palmVelocity.x * 0.72, -1.8, 1.8);
        orb.vy = clamp(palmVelocity.y * 0.72, -1.8, 1.8);
      }
    } else {
      // A moving open palm is a paddle. Contact transfers some of its velocity
      // to the orb, so a swipe or upward palm flick can bounce/launch it.
      stepPhysics(dt, palm, Math.max(0.035, palmWidth * 0.58), palmVelocity);
      if (gesture === "CLOSED" && distance(orb, { x: palm.x, y: palm.y - palmWidth * 0.9 }) < 0.19) {
        orb.mode = "grabbed";
        orb.x = palm.x;
        orb.y = palm.y - palmWidth * 0.9;
        orb.vx = 0;
        orb.vy = 0;
      }
    }

    previousPalm = { x: palm.x, y: palm.y };
    lastGesture = gesture;
    return snapshot();
  }

  function stepPhysics(dt, palm, palmRadius, palmVelocity) {
    if (dt <= 0 || orb.mode === "idle" || orb.mode === "grabbed") return;

    const gravity = 1.35;
    orb.vy += gravity * dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;

    // Mild air drag keeps repeated collisions controllable rather than endless.
    const drag = Math.exp(-0.12 * dt);
    orb.vx *= drag;
    orb.vy *= drag;
    orb.spin += orb.vx * dt * 3;

    // Viewport walls and floor.
    if (orb.x < orb.radius) {
      orb.x = orb.radius;
      orb.vx = Math.abs(orb.vx) * 0.72;
    } else if (orb.x > 1 - orb.radius) {
      orb.x = 1 - orb.radius;
      orb.vx = -Math.abs(orb.vx) * 0.72;
    }
    if (orb.y < orb.radius) {
      orb.y = orb.radius;
      orb.vy = Math.abs(orb.vy) * 0.68;
    } else if (orb.y > 1 - orb.radius) {
      orb.y = 1 - orb.radius;
      orb.vy = -Math.abs(orb.vy) * 0.72;
      if (Math.abs(orb.vy) < 0.12) orb.vy = 0;
    }

    if (!palm) return;
    const dx = orb.x - palm.x;
    const dy = orb.y - palm.y;
    const separation = Math.hypot(dx, dy) || 1e-5;
    const minDistance = palmRadius + orb.radius;

    if (separation < minDistance) {
      const nx = dx / separation;
      const ny = dy / separation;
      orb.x = palm.x + nx * minDistance;
      orb.y = palm.y + ny * minDistance;

      const relativeVx = orb.vx - palmVelocity.x;
      const relativeVy = orb.vy - palmVelocity.y;
      const normalSpeed = relativeVx * nx + relativeVy * ny;

      if (normalSpeed < 0) {
        const restitution = 0.82;
        const impulse = -(1 + restitution) * normalSpeed;
        orb.vx += impulse * nx + palmVelocity.x * 0.16;
        orb.vy += impulse * ny + palmVelocity.y * 0.16;
      }

      // Tangential hand movement adds a little spin and side-swipe energy.
      orb.vx += clamp(palmVelocity.x, -2.2, 2.2) * 0.12;
    }
  }

  function snapshot() {
    return { ...orb, lastGesture };
  }

  return { update, reset };
}
