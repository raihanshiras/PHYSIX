import { useEffect, useRef, useState } from "react";
import { startCamera, stopCamera } from "../engines/camera";
import "./Camera.css";

export default function Camera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("inactive");
  const [errorMessage, setErrorMessage] = useState("");

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
  }

  useEffect(() => () => stopCamera(streamRef.current), []);

  const isActive = status === "active";

  return (
    <section className="camera-panel" aria-label="Camera experiment">
      <div className="camera-toolbar">
        <div className="camera-heading">
          <span className={`status-indicator status-${status}`} />
          <span>{isActive ? "CAMERA CONNECTED" : status === "requesting" ? "WAITING FOR PERMISSION" : status === "error" ? "CAMERA UNAVAILABLE" : "CAMERA OFFLINE"}</span>
        </div>
        <span className="camera-resolution">LIVE INPUT / VIDEO</span>
      </div>
      <div className="camera-viewport">
        <video ref={videoRef} className={isActive ? "camera-video is-visible" : "camera-video"} autoPlay playsInline muted aria-label="Live webcam preview" />
        {!isActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon" aria-hidden="true">◉</div>
            <p>{status === "requesting" ? "Waiting for camera access…" : "Your camera feed will appear here"}</p>
          </div>
        )}
        <div className="viewport-tag">PHYSIX / INPUT 01</div>
      </div>
      <div className="camera-actions">
        <div className="camera-description">
          <strong>Webcam input</strong>
          <span>Video stays in this browser session.</span>
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
