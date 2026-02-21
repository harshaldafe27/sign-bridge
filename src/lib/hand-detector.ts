import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export interface HandDetectionResult {
  sign: string;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
}

let handLandmarker: HandLandmarker | null = null;
let isInitializing = false;

export async function initHandDetector(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;
  if (isInitializing) {
    // Wait for existing init
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return handLandmarker!;
  }

  isInitializing = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });

    return handLandmarker;
  } finally {
    isInitializing = false;
  }
}

function distance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Ported directly from Python two_way_system.py gesture logic:
 * - All fingers closed = "A"
 * - All fingers open = "SPACE"  
 * - Thumb-index distance 0.05-0.15 = "C"
 * - Index open, middle closed = "B"
 */
export function detectSign(
  landmarks: Array<{ x: number; y: number; z: number }>
): string {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexOpen = indexTip.y < landmarks[6].y;
  const middleOpen = middleTip.y < landmarks[10].y;
  const ringOpen = ringTip.y < landmarks[14].y;
  const pinkyOpen = pinkyTip.y < landmarks[18].y;

  const thumbIndexDist = distance(thumbTip, indexTip);

  // ----- LETTER LOGIC (matches Python exactly) -----
  if (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return "A";
  }

  if (indexOpen && middleOpen && ringOpen && pinkyOpen) {
    return "SPACE";
  }

  if (thumbIndexDist > 0.05 && thumbIndexDist < 0.15) {
    return "C";
  }

  if (indexOpen && !middleOpen) {
    return "B";
  }

  return "";
}

export function detectFromVideo(
  detector: HandLandmarker,
  video: HTMLVideoElement,
  timestamp: number
): HandDetectionResult {
  const result = detector.detectForVideo(video, timestamp);

  if (result.landmarks && result.landmarks.length > 0) {
    const landmarks = result.landmarks[0];
    const sign = detectSign(landmarks);
    return { sign, landmarks };
  }

  return { sign: "", landmarks: null };
}
