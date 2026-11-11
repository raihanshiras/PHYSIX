const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const magnitude = (x, y) => Math.hypot(x, y);

export function createOrbInteraction() {
  const orb = { mode: "idle", x: 0.5, y: 0.5, vx: 0, vy: 0, radius: 0.026, spin: 0 };
  let previousPalm = null;
  let previousPalmTime = 0;
  let lastFrameTime = 0;
  let palmVelocity = { x: 0, y: 0 };
  let lastImpactTime = 0;
  let contactLockUntil = 0;

  function reset() {
    Object.assign(orb, { mode: "idle", x: 0.5, y: 0.5, vx: 0, vy: 0, spin: 0 });
    previousPalm = null;
    previousPalmTime = 0;
    lastFrameTime = 0;
    palmVelocity = { x: 0, y: 0 };
    lastImpactTime = 0;
    contactLockUntil = 0;
  }

  function update({ palm, palmWidth = 0.12, gesture = "PARTIAL", now = performance.now(), palmTime = now }) {
    const dt = lastFrameTime ? clamp((now - lastFrameTime) / 1000, 0, 1 / 30) : 0;
    lastFrameTime = now;

    const priorPalm = previousPalm ? { ...previousPalm } : null;
    const isNewPalmSample = Boolean(palm && palmTime !== previousPalmTime);
    if (isNewPalmSample) {
      if (priorPalm && previousPalmTime && palmTime > previousPalmTime) {
        const sampleDt = Math.max(0.001, (palmTime - previousPalmTime) / 1000);
        const rawVx = clamp((palm.x - priorPalm.x) / sampleDt, -4.5, 4.5);
        const rawVy = clamp((palm.y - priorPalm.y) / sampleDt, -4.5, 4.5);
        // Keep fast intentional flicks while filtering single-frame landmark spikes.
        palmVelocity = {
          x: palmVelocity.x * 0.35 + rawVx * 0.65,
          y: palmVelocity.y * 0.35 + rawVy * 0.65,
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
          orb.vx = clamp(palmVelocity.x * 0.9, -2.8, 2.8);
          orb.vy = clamp(palmVelocity.y * 0.9, -2.8, 2.8);
          contactLockUntil = now + 100;
        }
      }
    } else {
      integrate(dt);

      if (palm && now >= contactLockUntil) {
        collideWithMovingPalm(palm, palmWidth, palmVelocity, priorPalm, now);
        // Bottom-of-frame scoop assist: an upward palm motion can lift a ball
        // resting on the floor even when the wrist/fingers are partly cropped
        // and the gesture classifier cannot confidently see a complete fist.
        const bottomScoop = orb.y > 0.84 &&
          palm.y > 0.68 &&
          Math.abs(orb.x - palm.x) < 0.25 &&
          palmVelocity.y < -0.12;
        if (bottomScoop && now - lastImpactTime > 180) {
          orb.vy = Math.min(orb.vy, -Math.max(0.9, Math.abs(palmVelocity.y) * 0.85));
          orb.vx += clamp(palmVelocity.x * 0.35, -0.45, 0.45);
          lastImpactTime = now;
          contactLockUntil = now + 110;
        }
        if (gesture === "CLOSED" && canCatchWithFist(palm, palmWidth)) {
          orb.mode = "grabbed";
          orb.x = palm.x;
          orb.y = palm.y - palmWidth * 0.9;
          orb.vx = 0;
          orb.vy = 0;
          contactLockUntil = now + 160;
        }
      }
    }

    return { ...orb };
  }

  function canCatchWithFist(palm, palmWidth) {
    const grabX = palm.x;
    const grabY = palm.y - palmWidth * 0.9;
    const dx = Math.abs(orb.x - grabX);
    const dy = Math.abs(orb.y - grabY);
    // A generous lower-screen catch zone compensates for the wrist/palm
    // reaching the camera frame edge while the ball is resting on the floor.
    const bottomRescue = orb.y > 0.78 && orb.y > grabY && dx < 0.28 && dy < 0.38;
    return magnitude(dx, dy) < 0.24 || bottomRescue;
  }

  function integrate(dt) {
    if (dt <= 0) return;
    // Two small substeps make contact and boundary response less frame-rate sensitive.
    const steps = 2;
    const step = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      orb.vy += 1.35 * step;
      orb.x += orb.vx * step;
      orb.y += orb.vy * step;
      const drag = Math.exp(-0.10 * step);
      orb.vx *= drag;
      orb.vy *= drag;
      orb.spin += orb.vx * step * 3;

      if (orb.x < orb.radius) {
        orb.x = orb.radius;
        orb.vx = Math.abs(orb.vx) * 0.82;
      } else if (orb.x > 1 - orb.radius) {
        orb.x = 1 - orb.radius;
        orb.vx = -Math.abs(orb.vx) * 0.82;
      }
      if (orb.y < orb.radius) {
        orb.y = orb.radius;
        orb.vy = Math.abs(orb.vy) * 0.76;
      } else if (orb.y > 1 - orb.radius) {
        orb.y = 1 - orb.radius;
        orb.vy = -Math.abs(orb.vy) * 0.82;
        if (Math.abs(orb.vy) < 0.10) orb.vy = 0;
      }
    }
  }

  function collideWithMovingPalm(palm, palmWidth, velocity, priorPalm, now) {
    const palmRadius = Math.max(0.065, palmWidth * 1.05);
    const start = priorPalm ?? palm;
    const dx = palm.x - start.x;
    const dy = palm.y - start.y;
    const segmentSq = dx * dx + dy * dy;
    const t = segmentSq > 1e-8
      ? clamp(((orb.x - start.x) * dx + (orb.y - start.y) * dy) / segmentSq, 0, 1)
      : 1;
    const closestX = start.x + dx * t;
    const closestY = start.y + dy * t;
    let nx = orb.x - closestX;
    let ny = orb.y - closestY;
    const separation = magnitude(nx, ny);
    const collisionDistance = palmRadius + orb.radius;

    // Wider interaction envelope makes the hand act like a soft paddle rather
    // than requiring a pixel-perfect touch at one particular angle.
    const sweptHit = separation <= collisionDistance + 0.025;
    if (!sweptHit) return;

    if (separation < 1e-4) {
      const speed = magnitude(velocity.x, velocity.y);
      if (speed > 0.08) {
        nx = -velocity.x / speed;
        ny = -velocity.y / speed;
      } else {
        nx = 0;
        ny = -1;
      }
    } else {
      nx /= separation;
      ny /= separation;
    }

    const movingSpeed = magnitude(velocity.x, velocity.y);
    const isFreshImpact = now - lastImpactTime > 180;
    if (isFreshImpact && movingSpeed > 0.12) {
      // Primary impulse follows the palm's travel direction, so an upward
      // swipe lifts the orb even if contact is not perfectly perpendicular.
      const transfer = clamp(movingSpeed * 0.9, 0.22, 2.9);
      orb.vx += velocity.x / movingSpeed * transfer;
      orb.vy += velocity.y / movingSpeed * transfer;

      // Add a small separation impulse to prevent the orb sticking inside hand.
      const separationImpulse = 0.28;
      orb.vx += nx * separationImpulse;
      orb.vy += ny * separationImpulse;
      lastImpactTime = now;
      contactLockUntil = now + 110;
    }

    // Resolve overlap only when the orb is close enough; do not snap it to a
    // distant point on the palm's path.
    if (separation < collisionDistance) {
      const pushOut = collisionDistance - separation;
      orb.x += nx * pushOut;
      orb.y += ny * pushOut;
    }
  }

  return { update, reset };
}
