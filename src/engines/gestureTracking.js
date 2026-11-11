const FINGERS = [
  { mcp: 5, pip: 6, dip: 7, tip: 8 },
  { mcp: 9, pip: 10, dip: 11, tip: 12 },
  { mcp: 13, pip: 14, dip: 15, tip: 16 },
  { mcp: 17, pip: 18, dip: 19, tip: 20 },
];

const OPEN_ENTER = 0.72;
const OPEN_EXIT = 0.58;
const CLOSED_ENTER = 0.28;
const CLOSED_EXIT = 0.42;
const TRANSITION_HOLD_MS = 130;
const EMA_ALPHA = 0.35;

function angleAtJoint(a, joint, c) {
  const ax = a.x - joint.x;
  const ay = a.y - joint.y;
  const cx = c.x - joint.x;
  const cy = c.y - joint.y;
  const denominator = Math.hypot(ax, ay) * Math.hypot(cx, cy);

  if (denominator < 1e-6) return 0;

  const cosine = Math.max(-1, Math.min(1, (ax * cx + ay * cy) / denominator));
  return Math.acos(cosine) * (180 / Math.PI);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * Converts hand landmarks into a stable OPEN / PARTIAL / CLOSED state.
 *
 * Each finger contributes a continuous extension score from its PIP joint
 * angle. An exponential moving average filters frame-to-frame landmark noise;
 * hysteresis and a short dwell time prevent state flicker at boundaries.
 */
export function createGestureTracker() {
  let smoothedScore = null;
  let stableState = "PARTIAL";
  let pendingState = null;
  let pendingSince = 0;

  function reset() {
    smoothedScore = null;
    stableState = "PARTIAL";
    pendingState = null;
    pendingSince = 0;
  }

  function update(landmarks, now = performance.now()) {
    const fingerScores = FINGERS.map(({ mcp, pip, dip, tip }) => {
      const pipAngle = angleAtJoint(
        landmarks[mcp],
        landmarks[pip],
        landmarks[dip],
      );

      // A straight finger approaches 180 degrees; a curled finger has a
      // smaller PIP angle. The 105–165 degree ramp avoids a brittle binary cut.
      const angleScore = clamp01((pipAngle - 105) / 60);

      // A fingertip extending beyond its MCP adds supporting evidence. Divide
      // by palm width so the score is independent of hand size in the frame.
      const palmWidth = Math.max(
        1e-4,
        Math.hypot(
          landmarks[5].x - landmarks[17].x,
          landmarks[5].y - landmarks[17].y,
        ),
      );
      const fingerReach = Math.hypot(
        landmarks[tip].x - landmarks[mcp].x,
        landmarks[tip].y - landmarks[mcp].y,
      ) / palmWidth;
      const reachScore = clamp01((fingerReach - 0.18) / 0.48);

      return angleScore * 0.75 + reachScore * 0.25;
    });

    const rawScore =
      fingerScores.reduce((sum, score) => sum + score, 0) /
      fingerScores.length;

    smoothedScore =
      smoothedScore === null
        ? rawScore
        : EMA_ALPHA * rawScore + (1 - EMA_ALPHA) * smoothedScore;

    let desiredState = "PARTIAL";

    if (stableState === "OPEN") {
      desiredState = smoothedScore >= OPEN_EXIT ? "OPEN" : "PARTIAL";
    } else if (stableState === "CLOSED") {
      desiredState = smoothedScore <= CLOSED_EXIT ? "CLOSED" : "PARTIAL";
    } else if (smoothedScore >= OPEN_ENTER) {
      desiredState = "OPEN";
    } else if (smoothedScore <= CLOSED_ENTER) {
      desiredState = "CLOSED";
    }

    if (desiredState === stableState) {
      pendingState = null;
      pendingSince = 0;
      return stableState;
    }

    if (pendingState !== desiredState) {
      pendingState = desiredState;
      pendingSince = now;
      return stableState;
    }

    if (now - pendingSince >= TRANSITION_HOLD_MS) {
      stableState = desiredState;
      pendingState = null;
      pendingSince = 0;
    }

    return stableState;
  }

  return { update, reset };
}
