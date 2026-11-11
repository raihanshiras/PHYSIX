import { useEffect, useRef, useState } from "react";
import { startCamera, stopCamera } from "../engines/camera";
import { createHandLandmarker } from "../engines/handTracking";
import { createGestureTracker } from "../engines/gestureTracking";
import "./Camera.css";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export default function Camera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const gestureTrackerRef = useRef(createGestureTracker());

  const [status, setStatus] = useState("inactive");
  const [errorMessage, setErrorMessage] = useState("");
  const [visionStatus, setVisionStatus] = useState("not-started");
  const [handInfo, setHandInfo] = useState(null);

  async function enableCamera() {
    if (streamRef.current) return;
    setStatus("requesting");
    setErrorMessage("");

    try {
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (streamRef.current === stream) {
            streamRef.current = null;
            setStatus("inactive");
          }
        }, { once: true });
      });
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
    clearOverlay();
  }

  function clearOverlay() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);
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

        const result = landmarker.detectForVideo(video, performance.now());
        drawHands(canvas, result.landmarks ?? []);

        const firstHand = result.landmarks?.[0];
        if (firstHand) {
          const palm = getPalmCenter(firstHand);
          setHandInfo((previous) => {
            const next = {
              state: gestureTrackerRef.current.update(firstHand),
              x: Math.round(palm.x * 100),
              y: Math.round(palm.y * 100),
              count: result.landmarks.length,
            };
            if (
              previous?.state === next.state &&
              previous?.x === next.x &&
              previous?.y === next.y &&
              previous?.count === next.count
            ) return previous;
            return next;
          });
        } else {
          gestureTrackerRef.current.reset();
          setHandInfo(null);
        }
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
        <span className="camera-resolution">LIVE INPUT / VIDEO</span>
      </div>

      <div className="camera-viewport">
        <video ref={videoRef} className={isActive ? "camera-video is-visible" : "camera-video"} autoPlay playsInline muted aria-label="Live webcam preview" />
        <canvas ref={canvasRef} className={isActive ? "hand-overlay is-visible" : "hand-overlay"} />
        {!isActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon" aria-hidden="true">◉</div>
            <p>{status === "requesting" ? "Waiting for camera access…" : "Your camera feed will appear here"}</p>
          </div>
        )}
        <div className="viewport-tag">PHYSIX / INPUT 01</div>
      </div>

      {isActive && (
        <div className="tracking-readout">
          <div>
            <span className="readout-label">VISION MODEL</span>
            <strong>{visionStatus === "loading" ? "LOADING MODEL…" : visionStatus === "ready" ? "HAND LANDMARKER READY" : visionStatus === "error" ? "MODEL ERROR" : "INITIALIZING"}</strong>
          </div>
          <div>
            <span className="readout-label">HAND STATE</span>
            <strong className={handInfo?.state === "OPEN" ? "state-open" : handInfo?.state === "CLOSED" ? "state-closed" : ""}>{handStateLabel}</strong>
          </div>
          <div>
            <span className="readout-label">PALM POSITION</span>
            <strong>{handInfo ? `X ${handInfo.x}% · Y ${handInfo.y}%` : "—"}</strong>
          </div>
        </div>
      )}

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

function getPalmCenter(landmarks) {
  // Average the wrist and four finger-base landmarks for a stable palm reference.
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
