import { useEffect, useRef, useState } from "react";
import { startCamera, stopCamera } from "../engines/camera";
import { createHandLandmarker } from "../engines/handTracking";
import { createGestureTracker } from "../engines/gestureTracking";
import { createPerformanceMonitor } from "../engines/performanceMonitor";
import "./Camera.css";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const EMPTY_METRICS = {
  cameraFps: 0,
  inferenceFps: 0,
  latestLatency: 0,
  averageLatency: 0,
  sampleCount: 0,
  handCount: 0,
  landmarkCount: 0,
  palmX: null,
  palmY: null,
  palmVelocity: null,
};

export default function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const gestureTrackerRef = useRef(createGestureTracker());
  const performanceMonitorRef = useRef(createPerformanceMonitor());
  const metricsRef = useRef({ ...EMPTY_METRICS });
  const lastPublishRef = useRef(0);
  const previousPalmRef = useRef(null);

  const [status, setStatus] = useState("inactive");
  const [errorMessage, setErrorMessage] = useState("");
  const [visionStatus, setVisionStatus] = useState("not-started");
  const [handInfo, setHandInfo] = useState(null);
  const [lowLightView, setLowLightView] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [metrics, setMetrics] = useState({ ...EMPTY_METRICS });

  async function enableCamera() {
    if (streamRef.current) return;
    setStatus("requesting");
    setErrorMessage("");

    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      metricsRef.current.cameraFps = videoTrack?.getSettings?.().frameRate ?? 0;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (streamRef.current === stream) {
            streamRef.current = null;
            setStatus("inactive");
          }
        }, { once: true });
      });
      setMetrics({ ...metricsRef.current });
      setStatus("active");
    } catch (error) {
      console.error("Unable to start camera:", error);
      setStatus("error");
      setErrorMessage(getCameraErrorMessage(error));
    }
  }

  function disableCamera() {
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("inactive");
    setVisionStatus("not-started");
    setHandInfo(null);
    performanceMonitorRef.current.reset();
    previousPalmRef.current = null;
    metricsRef.current = { ...EMPTY_METRICS };
    setMetrics({ ...EMPTY_METRICS });
    clearOverlay();
  }

  function clearOverlay() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function publishMetrics(now) {
    if (now - lastPublishRef.current < 200) return;
    lastPublishRef.current = now;
    const performance = performanceMonitorRef.current.snapshot();
    setMetrics({
      ...metricsRef.current,
      ...performance,
    });
  }

  const isActive = status === "active";

  useEffect(() => {
    if (!isActive) return undefined;

    let cancelled = false;

    async function startTracking() {
      setVisionStatus("loading");
      try {
        const landmarker = await createHandLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setVisionStatus("ready");
        detectFrame();
      } catch (error) {
        console.error("Hand Landmarker initialization failed:", error);
        if (!cancelled) {
          setVisionStatus("error");
          setErrorMessage(error?.message || "Hand tracking initialization failed. Check the browser console for details.");
        }
      }
    }

    function detectFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker || video.readyState < 2) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const inferenceStart = performance.now();
        const result = landmarker.detectForVideo(video, performance.now());
        const inferenceEnd = performance.now();
        performanceMonitorRef.current.recordInference(inferenceEnd - inferenceStart, inferenceEnd);

        const hands = result.landmarks ?? [];
        drawHands(canvas, hands);

        const firstHand = hands[0];
        metricsRef.current.handCount = hands.length;
        metricsRef.current.landmarkCount = hands.reduce((total, hand) => total + hand.length, 0);

        if (firstHand) {
          const palm = getPalmCenter(firstHand);
          const now = performance.now();
          const previousPalm = previousPalmRef.current;
          let velocity = null;

          if (previousPalm) {
            const elapsedSeconds = (now - previousPalm.time) / 1000;
            if (elapsedSeconds > 0) {
              const dx = (palm.x - previousPalm.x) * 100;
              const dy = (palm.y - previousPalm.y) * 100;
              velocity = Math.hypot(dx, dy) / elapsedSeconds;
            }
          }

          previousPalmRef.current = { x: palm.x, y: palm.y, time: now };
          metricsRef.current.palmX = Math.round(palm.x * 100);
          metricsRef.current.palmY = Math.round(palm.y * 100);
          metricsRef.current.palmVelocity = velocity === null ? null : Number(velocity.toFixed(1));

          const nextHandInfo = {
            state: gestureTrackerRef.current.update(firstHand, now),
            x: Math.round(palm.x * 100),
            y: Math.round(palm.y * 100),
            count: hands.length,
          };
          setHandInfo((previous) => (
            previous?.state === nextHandInfo.state &&
            previous?.x === nextHandInfo.x &&
            previous?.y === nextHandInfo.y &&
            previous?.count === nextHandInfo.count
              ? previous
              : nextHandInfo
          ));
        } else {
          previousPalmRef.current = null;
          metricsRef.current.palmX = null;
          metricsRef.current.palmY = null;
          metricsRef.current.palmVelocity = null;
          gestureTrackerRef.current.reset();
          setHandInfo(null);
        }

        publishMetrics(inferenceEnd);
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    }

    startTracking();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      lastVideoTimeRef.current = -1;
      gestureTrackerRef.current.reset();
      previousPalmRef.current = null;
      clearOverlay();
    };
  }, [isActive]);

  useEffect(() => () => {
    stopCamera(streamRef.current);
    landmarkerRef.current?.close();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  const handStateLabel = handInfo?.state ?? "NO HAND";

  return (
    <section className="camera-panel" aria-label="Camera and hand tracking experiment">
      <div className="camera-toolbar">
        <div className="camera-heading">
          <span className={`status-indicator status-${status}`} />
          <span>{isActive ? "CAMERA CONNECTED" : status === "requesting" ? "WAITING FOR PERMISSION" : status === "error" ? "CAMERA UNAVAILABLE" : "CAMERA OFFLINE"}</span>
        </div>
        <div className="camera-toolbar-tools">
          <button
            className={lowLightView ? "image-filter-toggle is-on" : "image-filter-toggle"}
            type="button"
            onClick={() => setLowLightView((enabled) => !enabled)}
            aria-pressed={lowLightView}
            title="Applies a subtle display-only filter. Hand detection uses the original camera frames."
          >
            <span className="filter-toggle-dot" />
            LOW-LIGHT {lowLightView ? "ON" : "OFF"}
          </button>
          <button
            className={dashboardOpen ? "dashboard-toggle is-on" : "dashboard-toggle"}
            type="button"
            onClick={() => setDashboardOpen((open) => !open)}
            aria-expanded={dashboardOpen}
            aria-controls="vision-dashboard"
          >
            <span className="dashboard-toggle-icon">▦</span>
            {dashboardOpen ? "HIDE DASHBOARD" : "SHOW DASHBOARD"}
          </button>
          <span className="camera-resolution">LIVE INPUT / VIDEO</span>
        </div>
      </div>

      <div className="camera-viewport">
        <video ref={videoRef} className={isActive ? (lowLightView ? "camera-video is-visible low-light-view" : "camera-video is-visible") : "camera-video"} autoPlay playsInline muted aria-label="Live webcam preview" />
        <canvas ref={canvasRef} className={isActive ? "hand-overlay is-visible" : "hand-overlay"} />
        {!isActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon" aria-hidden="true">◉</div>
            <p>{status === "requesting" ? "Waiting for camera access…" : "Your camera feed will appear here"}</p>
          </div>
        )}
        <div className="viewport-tag">PHYSIX / INPUT 01</div>
        {dashboardOpen && (
          <section className="vision-dashboard" id="vision-dashboard" aria-label="Vision performance dashboard">
            <div className="dashboard-heading">
              <div className="dashboard-title">
                <span className={isActive && visionStatus === "ready" ? "dashboard-live-dot" : "dashboard-idle-dot"} />
                <strong>VISION TELEMETRY</strong>
              </div>
              <button type="button" className="dashboard-close" aria-label="Close vision dashboard" onClick={() => setDashboardOpen(false)}>×</button>
            </div>
            <div className="dashboard-metrics-grid">
              <MetricCard label="INFERENCE FPS" value={isActive ? metrics.inferenceFps.toFixed(1) : "—"} />
              <MetricCard label="LATENCY" value={isActive && metrics.sampleCount ? `${metrics.latestLatency.toFixed(1)} ms` : "—"} />
              <MetricCard label="AVG LATENCY" value={isActive && metrics.sampleCount ? `${metrics.averageLatency.toFixed(1)} ms` : "—"} />
              <MetricCard label="CAMERA FPS" value={isActive && metrics.cameraFps ? metrics.cameraFps.toFixed(0) : "—"} />
              <MetricCard label="HANDS" value={isActive ? String(metrics.handCount) : "—"} />
              <MetricCard label="LANDMARKS" value={isActive ? String(metrics.landmarkCount) : "—"} />
            </div>
            <div className="dashboard-compact-details">
              <span>PALM <strong>{isActive && metrics.palmX !== null ? `${metrics.palmX}%, ${metrics.palmY}%` : "—"}</strong></span>
              <span>SPEED <strong>{isActive && metrics.palmVelocity !== null ? `${metrics.palmVelocity} %/s` : "—"}</strong></span>
              <span>MODEL <strong>{visionStatus === "ready" ? "READY" : visionStatus === "loading" ? "LOADING" : visionStatus === "error" ? "ERROR" : "OFF"}</strong></span>
            </div>
          </section>
        )}
      </div>

      <div className="camera-actions">
        <div className="camera-description">
          <strong>Hand tracking</strong>
          <span>Landmarks are processed locally in your browser.</span>
        </div>
        {isActive ? (
          <button className="camera-button camera-button-secondary" onClick={disableCamera}>Stop camera</button>
        ) : (
          <button className="camera-button" onClick={enableCamera} disabled={status === "requesting"}>
            {status === "requesting" ? "Connecting…" : "Enable camera"}
          </button>
        )}
      </div>
      {errorMessage && <p className="camera-error" role="alert">{errorMessage}</p>}
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPalmCenter(landmarks) {
  const palmPoints = [0, 5, 9, 13, 17].map((index) => landmarks[index]);
  return {
    x: palmPoints.reduce((sum, point) => sum + point.x, 0) / palmPoints.length,
    y: palmPoints.reduce((sum, point) => sum + point.y, 0) / palmPoints.length,
  };
}

function drawHands(canvas, hands) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const landmarks of hands) {
    context.lineWidth = Math.max(2, canvas.width / 400);
    context.strokeStyle = "#8be0bd";
    context.fillStyle = "#ffffff";

    for (const [start, end] of HAND_CONNECTIONS) {
      context.beginPath();
      context.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
      context.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
      context.stroke();
    }

    for (const point of landmarks) {
      context.beginPath();
      context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 220), 0, Math.PI * 2);
      context.fill();
    }

    const palm = getPalmCenter(landmarks);
    context.beginPath();
    context.arc(palm.x * canvas.width, palm.y * canvas.height, Math.max(6, canvas.width / 100), 0, Math.PI * 2);
    context.strokeStyle = "#f4c96b";
    context.lineWidth = Math.max(2, canvas.width / 300);
    context.stroke();
  }
}

function getCameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was denied. Allow camera access in your browser settings and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found. Connect a camera and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera may already be in use by another application.";
    case "OverconstrainedError":
      return "The camera cannot satisfy the requested video settings.";
    case "SecurityError":
      return "Camera access is blocked in this browser context. Use localhost or HTTPS.";
    default:
      return error?.message || "An unexpected camera error occurred.";
  }
}
