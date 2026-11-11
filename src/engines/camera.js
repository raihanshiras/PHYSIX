/**
 * Camera engine — browser camera access with no React dependencies.
 */
export async function startCamera(videoElement) {
  if (!videoElement) throw new Error("A video element is required to start the camera.");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera access is unavailable. Use a supported browser over HTTPS or localhost.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user",
    },
    audio: false,
  });

  try {
    videoElement.srcObject = stream;
    await videoElement.play();
    return stream;
  } catch (error) {
    stopCamera(stream);
    videoElement.srcObject = null;
    throw error;
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}
