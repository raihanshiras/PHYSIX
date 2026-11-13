import { useEffect, useRef, useState } from "react";
import { startCamera, stopCamera } from "../engines/camera";
import { createHandLandmarker } from "../engines/handTracking";
import { createGestureTracker } from "../engines/gestureTracking";
import { createPerformanceMonitor } from "../engines/performanceMonitor";
import { createPalmTracker } from "../engines/palmTracking";
import { createOrbInteraction } from "../engines/orbInteraction";
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
  const palmTrackerRef = useRef(createPalmTracker());
  const orbInteractionRef = useRef(createOrbInteraction());
  const metricsRef = useRef({ ...EMPTY_METRICS });
  const lastPublishRef = useRef(0);
  const previousPalmRef = useRef(null);
  const latestVisionRef = useRef({ hands: [], palm: null, palmWidth: 0.12, gesture: "PARTIAL", palmTime: 0 });
  const physicsAnimationRef = useRef(null);

  const [status, setStatus] = useState("inactive");
  const [errorMessage, setErrorMessage] = useState("");
  const [visionStatus, setVisionStatus] = useState("not-started");
  const [handInfo, setHandInfo] = useState(null);
  const [lowLightView, setLowLightView] = useState(false);
  const [cameraOpacity, setCameraOpacity] = useState(28);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [metrics, setMetrics] = useState({ ...EMPTY_METRICS });
  const [orbStatus, setOrbStatus] = useState("WAITING FOR HAND");

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
    palmTrackerRef.current.reset();
    orbInteractionRef.current.reset();
    latestVisionRef.current = { hands: [], palm: null, palmWidth: 0.12, gesture: "PARTIAL", palmTime: 0 };
    setOrbStatus("WAITING FOR HAND");
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
        renderPhysicsFrame();
      } catch (error) {
        console.error("Hand Landmarker initialization failed:", error);
        if (!cancelled) {
          setVisionStatus("error");
          setErrorMessage(error?.message || "Hand tracking initialization failed. Check the browser console for details.");
        }
      }
    }

    function renderPhysicsFrame() {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && video.videoWidth && video.videoHeight) {
        const width = Math.max(1, Math.round(canvas.clientWidth));
        const height = Math.max(1, Math.round(canvas.clientHeight));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const vision = latestVisionRef.current;
        const orb = orbInteractionRef.current.update({ palm: vision.palm, palmWidth: vision.palmWidth, gesture: vision.gesture, palmTime: vision.palmTime, now: performance.now() });
        drawHands(canvas, vision.hands, video.videoWidth, video.videoHeight);
        drawOrb(canvas, orb, video.videoWidth, video.videoHeight);
        const nextOrbStatus = orb.mode === "grabbed" ? "GRABBED · MOVE YOUR HAND" : orb.mode === "falling" ? "IN PLAY · HIT WITH YOUR PALM" : vision.palm ? "CLOSE FIST TO GRAB" : "WAITING FOR HAND";
        setOrbStatus((previous) => previous === nextOrbStatus ? previous : nextOrbStatus);
      }
      physicsAnimationRef.current = requestAnimationFrame(renderPhysicsFrame);
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
        const firstHand = hands[0];
        const rawPalm = firstHand ? getPalmCenter(firstHand) : null;
        const smoothedPalm = palmTrackerRef.current.update(rawPalm, inferenceEnd);
        const palm = smoothedPalm ?? rawPalm;
        const now = inferenceEnd;

        metricsRef.current.handCount = hands.length;
        metricsRef.current.landmarkCount = hands.reduce((total, hand) => total + hand.length, 0);

        let gesture = "PARTIAL";
        if (firstHand && palm) {
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
          gesture = gestureTrackerRef.current.update(firstHand, now);

          const nextHandInfo = {
            state: gesture,
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
          palmTrackerRef.current.reset();
          metricsRef.current.palmX = null;
          metricsRef.current.palmY = null;
          metricsRef.current.palmVelocity = null;
          gestureTrackerRef.current.reset();
          setHandInfo(null);
        }

        const palmWidth = firstHand
          ? Math.hypot(firstHand[5].x - firstHand[17].x, firstHand[5].y - firstHand[17].y)
          : 0.12;
        latestVisionRef.current = { hands, palm, palmWidth, gesture, palmTime: inferenceEnd };
        publishMetrics(inferenceEnd);
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    }

    startTracking();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (physicsAnimationRef.current) cancelAnimationFrame(physicsAnimationRef.current);
      animationRef.current = null;
      physicsAnimationRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      lastVideoTimeRef.current = -1;
      gestureTrackerRef.current.reset();
      previousPalmRef.current = null;
      palmTrackerRef.current.reset();
      orbInteractionRef.current.reset();
      latestVisionRef.current = { hands: [], palm: null, palmWidth: 0.12, gesture: "PARTIAL", palmTime: 0 };
      clearOverlay();
    };
  }, [isActive]);

  useEffect(() => () => {
    stopCamera(streamRef.current);
    landmarkerRef.current?.close();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (physicsAnimationRef.current) cancelAnimationFrame(physicsAnimationRef.current);
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
          <label className="camera-opacity-control" title="Adjust how visible the webcam background is">
            <span>CAMERA</span>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={cameraOpacity}
              onChange={(event) => setCameraOpacity(Number(event.target.value))}
              aria-label="Camera background visibility"
            />
            <output>{cameraOpacity}%</output>
          </label>
          <span className="camera-resolution">LIVE INPUT / VIDEO</span>
        </div>
      </div>

      <div className="camera-viewport">
        <video ref={videoRef} style={{ opacity: cameraOpacity / 100 }} className={isActive ? (lowLightView ? "camera-video is-visible low-light-view" : "camera-video is-visible") : "camera-video"} autoPlay playsInline muted aria-label="Live webcam preview" />
        <canvas ref={canvasRef} className={isActive ? "hand-overlay is-visible" : "hand-overlay"} />
        {!isActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon" aria-hidden="true">◉</div>
            <p>{status === "requesting" ? "Waiting for camera access…" : "Your camera feed will appear here"}</p>
          </div>
        )}
        <div className="viewport-tag">PHYSIX / INPUT 01</div>
        {isActive && <div className="orb-interaction-hint">{orbStatus}</div>}
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

function mapVideoPoint(x, y, canvas, videoWidth, videoHeight) {
  const scale = Math.max(canvas.width / videoWidth, canvas.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  return { x: x * renderedWidth + (canvas.width - renderedWidth) / 2, y: y * renderedHeight + (canvas.height - renderedHeight) / 2, scale };
}

function drawHands(canvas, hands, videoWidth, videoHeight) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const point = (landmark) => mapVideoPoint(landmark.x, landmark.y, canvas, videoWidth, videoHeight);
  for (const landmarks of hands) {
    // High-contrast landmark rendering keeps hands readable over the dimmed
    // webcam without restoring the full-opacity camera image.
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = "#65f5c5";
    context.shadowBlur = Math.max(5, canvas.width / 150);
    context.lineWidth = Math.max(2.5, canvas.width / 330);
    context.strokeStyle = "rgba(105, 255, 207, 0.96)";
    context.fillStyle = "#effff9";
    for (const [start, end] of HAND_CONNECTIONS) {
      const p1 = point(landmarks[start]), p2 = point(landmarks[end]);
      context.beginPath(); context.moveTo(p1.x, p1.y); context.lineTo(p2.x, p2.y); context.stroke();
    }
    context.shadowBlur = Math.max(3, canvas.width / 260);
    for (const landmark of landmarks) {
      const p = point(landmark);
      context.beginPath(); context.arc(p.x, p.y, Math.max(3.5, canvas.width / 210), 0, Math.PI * 2); context.fill();
    }
    const p = point(getPalmCenter(landmarks));
    context.shadowColor = "#ffc96b";
    context.shadowBlur = Math.max(8, canvas.width / 100);
    context.beginPath(); context.arc(p.x, p.y, Math.max(7, canvas.width / 95), 0, Math.PI * 2);
    context.strokeStyle = "#ffd27d"; context.lineWidth = Math.max(2.5, canvas.width / 280); context.stroke();
    context.restore();
  }
}

function drawOrb(canvas, orb, videoWidth, videoHeight) {
  const mapped = mapVideoPoint(orb.x, orb.y, canvas, videoWidth, videoHeight);
  const context = canvas.getContext("2d");
  const radius = orb.radius * videoWidth * mapped.scale;
  const grabbed = orb.mode === "grabbed";
  context.save(); context.translate(mapped.x, mapped.y); context.rotate(orb.spin || 0);
  context.shadowColor = grabbed ? "#a4ffca" : "#55e6ff"; context.shadowBlur = radius * 1.5;
  const glow = context.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.08, 0, 0, radius);
  glow.addColorStop(0, "#f2ffff"); glow.addColorStop(0.28, grabbed ? "#baffd5" : "#8df4ff");
  glow.addColorStop(0.72, grabbed ? "#43d991" : "#22b8df"); glow.addColorStop(1, grabbed ? "#176b50" : "#12618f");
  context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2); context.fillStyle = glow; context.fill();
  context.shadowBlur = 0; context.lineWidth = Math.max(1.5, radius * 0.07); context.strokeStyle = "#d7ffff"; context.stroke();
  context.beginPath(); context.ellipse(0, radius * 1.35, radius * 1.35, radius * 0.28, 0, 0, Math.PI * 2);
  context.strokeStyle = "#72eaffbb"; context.lineWidth = Math.max(1, radius * 0.045); context.stroke();
  context.restore();
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
