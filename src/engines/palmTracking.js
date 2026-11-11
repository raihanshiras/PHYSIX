/**
 * Time-based palm smoothing for stable screen-space object anchoring.
 * Coordinates are normalized MediaPipe image coordinates (0..1).
 */
export function createPalmTracker({ smoothingMs = 75 } = {}) {
  let position = null;
  let lastTime = 0;

  function update(point, now = performance.now()) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      reset();
      return null;
    }

    if (!position || now <= lastTime) {
      position = { x: point.x, y: point.y };
    } else {
      const elapsed = now - lastTime;
      const alpha = 1 - Math.exp(-elapsed / Math.max(1, smoothingMs));
      position = {
        x: position.x + (point.x - position.x) * alpha,
        y: position.y + (point.y - position.y) * alpha,
      };
    }

    lastTime = now;
    return { ...position };
  }

  function reset() {
    position = null;
    lastTime = 0;
  }

  return { update, reset };
}
