# PHYSIX

An interactive reality and physics learning laboratory, built step by step to study browser APIs, computer vision, simulation, and augmented reality.

## Current milestone: 1A — Webcam foundation

- Request webcam permission.
- Display the live camera stream.
- Show permission and camera errors.
- Stop camera tracks when the camera is disabled or the component unmounts.

Hand detection and MediaPipe are deliberately not included yet. They will be introduced in the next experiment.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Camera access works on secure contexts, including localhost.

## What this experiment teaches

The browser's `navigator.mediaDevices.getUserMedia()` API requests permission and returns a `MediaStream`. Assigning the stream to a video's `srcObject` displays the camera. Calling `stop()` on each track releases the camera.

React's `useRef` stores the video element and stream without triggering renders; `useState` stores UI status; effect cleanup releases the stream when the component unmounts.

## Project principles

- Learn each system before adding the next one.
- Keep device integration separate from the UI.
- Keep computer vision and physics logic out of React components.
- Prefer understandable, testable steps over premature abstraction.


## Experiment 1B — Hand landmarks

The browser now loads MediaPipe Tasks Vision's Hand Landmarker model and runs it on new webcam frames.

- 21 landmarks are drawn over each detected hand.
- A palm reference point is calculated by averaging landmarks 0, 5, 9, 13, and 17.
- The first-pass hand-state heuristic counts extended fingers using fingertip/PIP distances from the wrist.
- The hand-state classifier reports OPEN, CLOSED, or PARTIAL.

### How it works

1. `createHandLandmarker()` loads the MediaPipe WASM runtime and hand-landmark model.
2. The camera component sends each new video frame to `detectForVideo()`.
3. MediaPipe returns normalized landmark coordinates (0–1 relative to the input frame).
4. Canvas draws the 21 points and their connections over the mirrored video.
5. A simple geometry heuristic estimates palm position and hand openness.

The open/closed classifier is an educational first approximation, not a robust gesture-recognition model. It works best with the palm facing the camera; orientation-aware logic and temporal smoothing are future improvements.

The model and WASM runtime are downloaded from Google's MediaPipe model hosting and jsDelivr on first use. Camera frames are processed locally in the browser.
