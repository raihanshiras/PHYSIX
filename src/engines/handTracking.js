import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
const WASM_URL="/mediapipe/wasm/";
const MODEL_URL="https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const OPTIONS={runningMode:"VIDEO",numHands:1,minHandDetectionConfidence:0.68,minHandPresenceConfidence:0.62,minTrackingConfidence:0.68};
export async function createHandLandmarker(){
  let vision;
  try{vision=await FilesetResolver.forVisionTasks(WASM_URL);}
  catch(error){throw new Error(`Could not load the local MediaPipe WASM runtime from ${WASM_URL}. Run "npm install" and restart Vite. Original error: ${error.message}`,{cause:error});}
  try{return await HandLandmarker.createFromOptions(vision,{...OPTIONS,baseOptions:{modelAssetPath:MODEL_URL,delegate:"GPU"}});}
  catch(gpuError){
    console.warn("MediaPipe GPU initialization failed; retrying with CPU.",gpuError);
    try{return await HandLandmarker.createFromOptions(vision,{...OPTIONS,baseOptions:{modelAssetPath:MODEL_URL,delegate:"CPU"}});}
    catch(cpuError){throw new Error(`MediaPipe could not initialize with GPU or CPU. Check that the hand model can be downloaded and that the browser allows WebAssembly. GPU: ${gpuError.message} | CPU: ${cpuError.message}`,{cause:cpuError});}
  }
}