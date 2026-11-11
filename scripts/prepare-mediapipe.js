import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "node_modules/@mediapipe/tasks-vision/wasm");
const destination = resolve(projectRoot, "public/mediapipe/wasm");

if (!existsSync(source)) {
  console.error(
    "MediaPipe WASM assets were not found in node_modules. Run npm install, then npm run prepare:mediapipe.",
  );
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

const requiredFiles = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(destination, file))) {
    console.error(`Expected MediaPipe runtime file is missing: ${file}`);
    process.exit(1);
  }
}

console.log("MediaPipe WASM runtime copied locally into public/mediapipe/wasm.");
