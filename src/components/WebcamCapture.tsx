import { useRef, useEffect, useState, useCallback } from "react";
import { Camera, CameraOff, Hand, Volume2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  initHandDetector,
  detectFromVideo,
  type HandDetectionResult,
} from "@/lib/hand-detector";

interface WebcamCaptureProps {
  onGestureDetected?: (text: string) => void;
  isActive: boolean;
}

const WebcamCapture = ({ onGestureDetected, isActive }: WebcamCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSign, setCurrentSign] = useState("");
  const [word, setWord] = useState("");
  const [sentence, setSentence] = useState("");

  const previousSignRef = useRef("");
  const lastAddTimeRef = useRef(0);
  const detectorRef = useRef<Awaited<ReturnType<typeof initHandDetector>> | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setCameraOn(true);
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOn(false);
    setDetecting(false);
    setCurrentSign("");
  }, [stream]);

  const startDetection = useCallback(async () => {
    if (!videoRef.current) return;
    setLoading(true);

    try {
      const detector = await initHandDetector();
      detectorRef.current = detector;
      setDetecting(true);
      setLoading(false);

      const video = videoRef.current;
      let lastTimestamp = -1;

      const detectLoop = () => {
        if (!video || video.paused || video.ended) return;

        const now = performance.now();
        if (now !== lastTimestamp) {
          lastTimestamp = now;
          const result: HandDetectionResult = detectFromVideo(detector, video, now);

          // Draw landmarks on canvas
          drawLandmarks(result.landmarks);

          if (result.sign) {
            setCurrentSign(result.sign);

            if (
              result.sign !== previousSignRef.current &&
              now - lastAddTimeRef.current > 1000
            ) {
              if (result.sign === "SPACE") {
                setWord((prev) => {
                  if (prev) {
                    setSentence((s) => s + prev + " ");
                    onGestureDetected?.(prev);
                  }
                  return "";
                });
              } else {
                setWord((prev) => prev + result.sign);
                // Speak the letter using TTS
                const utterance = new SpeechSynthesisUtterance(result.sign);
                utterance.rate = 1.5;
                speechSynthesis.speak(utterance);
              }
              lastAddTimeRef.current = now;
            }
          } else {
            setCurrentSign("");
          }

          previousSignRef.current = result.sign;
        }

        animFrameRef.current = requestAnimationFrame(detectLoop);
      };

      detectLoop();
    } catch (err) {
      console.error("Failed to init hand detector:", err);
      setLoading(false);
    }
  }, [onGestureDetected]);

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setDetecting(false);
    setCurrentSign("");
  }, []);

  const drawLandmarks = (
    landmarks: Array<{ x: number; y: number; z: number }> | null
  ) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks) return;

    // Draw connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17],
    ];

    ctx.strokeStyle = "hsl(174, 72%, 40%)";
    ctx.lineWidth = 2;
    for (const [a, b] of connections) {
      // Mirror x for selfie view
      const x1 = (1 - landmarks[a].x) * canvas.width;
      const y1 = landmarks[a].y * canvas.height;
      const x2 = (1 - landmarks[b].x) * canvas.width;
      const y2 = landmarks[b].y * canvas.height;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw points
    for (const lm of landmarks) {
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "hsl(174, 72%, 55%)";
      ctx.fill();
      ctx.strokeStyle = "hsl(0, 0%, 100%)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const speakSentence = () => {
    const full = sentence + word;
    if (full.trim()) {
      const utterance = new SpeechSynthesisUtterance(full.trim());
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
      onGestureDetected?.(full.trim());
    }
  };

  const clearAll = () => {
    setWord("");
    setSentence("");
    setCurrentSign("");
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Video + canvas overlay */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-foreground/5 border border-border">
        {cameraOn ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full pointer-events-none"
            />
            {detecting && (
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground">
                <span className="h-2 w-2 rounded-full bg-primary-foreground recording-pulse" />
                Detecting Signs
              </div>
            )}
            {currentSign && (
              <div className="absolute top-3 right-3 rounded-xl bg-foreground/80 px-4 py-2 text-2xl font-bold text-background font-display">
                {currentSign}
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-3 shadow-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Loading AI model...</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Camera className="h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">Camera is off</p>
            <p className="text-xs opacity-70">Enable camera to start sign detection</p>
          </div>
        )}
      </div>

      {/* Sentence builder display */}
      {(sentence || word) && (
        <div className="rounded-lg bg-foreground/5 border border-border p-3 space-y-1">
          {sentence && (
            <p className="text-xs text-muted-foreground">
              Sentence: <span className="text-foreground font-medium">{sentence}</span>
            </p>
          )}
          <p className="text-lg font-display font-bold text-primary">
            {word || "…"}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          onClick={cameraOn ? stopCamera : startCamera}
          variant={cameraOn ? "destructive" : "default"}
          className="flex-1"
          size="sm"
        >
          {cameraOn ? (
            <CameraOff className="mr-2 h-4 w-4" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          {cameraOn ? "Stop Camera" : "Start Camera"}
        </Button>
        {cameraOn && !detecting && (
          <Button
            onClick={startDetection}
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={loading}
          >
            <Hand className="mr-2 h-4 w-4" />
            Detect Signs
          </Button>
        )}
        {detecting && (
          <Button onClick={stopDetection} variant="secondary" size="sm" className="flex-1">
            <Hand className="mr-2 h-4 w-4" />
            Stop
          </Button>
        )}
      </div>

      {(sentence || word) && (
        <div className="flex gap-2">
          <Button onClick={speakSentence} variant="outline" size="sm" className="flex-1">
            <Volume2 className="mr-2 h-4 w-4" />
            Speak
          </Button>
          <Button onClick={clearAll} variant="outline" size="sm" className="flex-1">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
