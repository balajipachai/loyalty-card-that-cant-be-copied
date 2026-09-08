"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type ScanState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "scanning" }
  | { status: "awarding" }
  | { status: "success"; walletAddress: string; freeCakeEarned: boolean }
  | { status: "error"; message: string };

const STAFF_PIN_STORAGE_KEY = "staff-pin";

export function StaffScanner() {
  const [pin, setPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  // The PIN never leaves this device except as a header on the award
  // request itself - it's kept in sessionStorage purely so staff don't
  // retype it between customers on their own shift.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STAFF_PIN_STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPin(saved);
        setPinSaved(true);
      }
    } catch {
      // sessionStorage unavailable (private mode etc.) - just skip persistence.
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submitScan = useCallback(
    async (raw: string) => {
      stopCamera();
      setScan({ status: "awarding" });
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        setScan({ status: "error", message: "That code isn't a loyalty QR code." });
        return;
      }
      try {
        const res = await fetch("/api/staff/award", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-staff-pin": pin },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setScan({ status: "error", message: data.error ?? "Could not add the stamp." });
          return;
        }
        setScan({ status: "success", walletAddress: data.walletAddress, freeCakeEarned: data.freeCakeEarned });
      } catch {
        setScan({ status: "error", message: "Could not reach the server. Check your connection." });
      }
    },
    [pin, stopCamera],
  );

  // Held in a ref (rather than referencing `tick` from inside its own
  // useCallback body) purely so the recursive requestAnimationFrame loop
  // always calls the latest closure without eslint flagging a
  // reference-before-declaration.
  const tickRef = useRef<() => void>(() => {});

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      frameRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height);
    if (code) {
      submitScan(code.data);
      return;
    }
    frameRef.current = requestAnimationFrame(() => tickRef.current());
  }, [submitScan]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const startScanning = useCallback(async () => {
    setScan({ status: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScan({ status: "scanning" });
      frameRef.current = requestAnimationFrame(() => tickRef.current());
    } catch {
      setScan({ status: "error", message: "Could not access the camera. Check permissions and try again." });
    }
  }, []);

  const savePin = useCallback(() => {
    try {
      sessionStorage.setItem(STAFF_PIN_STORAGE_KEY, pin);
    } catch {
      // ignore - PIN just won't persist across reloads on this device.
    }
    setPinSaved(true);
  }, [pin]);

  const scanNext = useCallback(() => {
    setScan({ status: "idle" });
  }, []);

  if (!pinSaved) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">Staff sign-in</h2>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Staff PIN"
          className="w-full rounded-lg border border-amber-300 px-4 py-2 text-center text-lg tracking-widest text-amber-950"
        />
        <button
          type="button"
          onClick={savePin}
          disabled={!pin}
          className="w-full rounded-full bg-amber-900 px-6 py-3 text-base font-medium text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-amber-950">Scan customer code</h2>

      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-amber-950">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${scan.status === "scanning" ? "" : "hidden"}`}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        {scan.status === "idle" && <p className="text-sm text-amber-200">Camera off</p>}
        {scan.status === "starting" && <p className="text-sm text-amber-200">Starting camera...</p>}
        {scan.status === "awarding" && <p className="text-sm text-amber-200">Adding stamp...</p>}
        {scan.status === "success" && (
          <p className="px-4 text-center text-sm font-medium text-green-300">
            {scan.freeCakeEarned ? "Free cake earned!" : "Stamp added!"}
            <br />
            <span className="font-mono text-xs text-amber-200">
              {scan.walletAddress.slice(0, 6)}...{scan.walletAddress.slice(-4)}
            </span>
          </p>
        )}
        {scan.status === "error" && <p className="px-4 text-center text-sm text-red-300">{scan.message}</p>}
      </div>

      {scan.status === "idle" && (
        <button
          type="button"
          onClick={startScanning}
          className="w-full rounded-full bg-amber-900 px-6 py-3 text-base font-medium text-amber-50"
        >
          Start scanning
        </button>
      )}
      {scan.status === "error" && (
        <button
          type="button"
          onClick={startScanning}
          className="w-full rounded-full bg-amber-900 px-6 py-3 text-base font-medium text-amber-50"
        >
          Try again
        </button>
      )}
      {scan.status === "success" && (
        <button
          type="button"
          onClick={scanNext}
          className="w-full rounded-full bg-amber-900 px-6 py-3 text-base font-medium text-amber-50"
        >
          Scan next customer
        </button>
      )}
    </div>
  );
}
