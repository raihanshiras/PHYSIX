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
