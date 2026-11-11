/**
 * Lightweight rolling performance monitor for the PHYSIX vision pipeline.
 * Inference FPS is measured from completed calls, not inferred from latency.
 */
export function createPerformanceMonitor({ windowMs = 1000, latencySamples = 30 } = {}) {
  let completed = 0;
  let windowStartedAt = performance.now();
  let inferenceFps = 0;
  let latencies = [];
  let latestLatency = 0;

  function recordInference(durationMs, now = performance.now()) {
    completed += 1;
    latestLatency = durationMs;
    latencies.push(durationMs);
    if (latencies.length > latencySamples) latencies.shift();

    const elapsed = now - windowStartedAt;
    if (elapsed >= windowMs) {
      inferenceFps = (completed * 1000) / elapsed;
      completed = 0;
      windowStartedAt = now;
    }
  }

  function snapshot() {
    const averageLatency = latencies.length
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 0;

    return {
      inferenceFps: Number(inferenceFps.toFixed(1)),
      latestLatency: Number(latestLatency.toFixed(1)),
      averageLatency: Number(averageLatency.toFixed(1)),
      sampleCount: latencies.length,
    };
  }

  function reset() {
    completed = 0;
    windowStartedAt = performance.now();
    inferenceFps = 0;
    latencies = [];
    latestLatency = 0;
  }

  return { recordInference, snapshot, reset };
}
