# PHYSIX

An interactive reality and physics learning laboratory, built step by step to study browser APIs, computer vision, simulation, and augmented reality.

## Current milestone: 1B — Hand landmark tracking

- Request webcam permission and display the live camera stream.
- Load MediaPipe Hand Landmarker.
- Detect up to two hands and draw their 21 landmarks.
- Estimate palm position.
- Classify the first hand as OPEN, CLOSED, or PARTIAL using a first-pass geometric heuristic.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Camera access works on secure contexts, including localhost.

## MediaPipe asset loading

The JavaScript API is installed from npm. Its matching WebAssembly runtime files are copied from `node_modules/@mediapipe/tasks-vision/wasm` into `public/mediapipe/wasm` by `scripts/prepare-mediapipe.js`.

This is run automatically after `npm install`, before `npm run dev`, and before `npm run build`. Keeping the WASM files local avoids a CDN path/version mismatch and removes the CDN request that previously returned 404.

The hand-landmark model is still fetched from Google's model hosting on first initialization. If model loading fails, inspect the browser Network tab for the `hand_landmarker.task` request.

## How hand tracking works

1. `createHandLandmarker()` loads the local MediaPipe WASM runtime and the hand model.
2. The camera component sends each new video frame to `detectForVideo()`.
3. MediaPipe returns 21 normalized landmark coordinates per detected hand.
4. Canvas draws the landmarks and their connections over the mirrored video.
5. A geometric heuristic estimates palm position and hand openness.

Gesture classification uses the four non-thumb fingers. Each finger contributes a continuous extension score based on its PIP joint angle and normalized fingertip reach. The scores are filtered with an exponential moving average, then OPEN/CLOSED transitions use separate enter/exit thresholds (hysteresis) and a 130 ms confirmation window. This reduces flicker when landmarks jitter near a boundary. PARTIAL is the middle range. This is still a practical 2D approximation: hand rotation, occlusion, and unusual camera angles can affect it.

Camera frames are processed locally in the browser. The model file is downloaded from Google's hosting service; the webcam stream is not uploaded by this application.

## Project principles

- Learn each system before adding the next one.
- Keep device integration separate from the UI.
- Keep computer vision and physics logic out of React components.
- Prefer understandable, testable steps over premature abstraction.
