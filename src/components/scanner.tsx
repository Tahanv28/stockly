"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconX } from "./icons";
import { Button } from "./ui";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

let detectorPromise: Promise<Detector> | null = null;

async function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const mod = await import("barcode-detector/ponyfill");
    mod.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path,
      },
    });
    return new mod.BarcodeDetector({
      formats: [
        "qr_code",
        "ean_13",
        "ean_8",
        "upc_a",
        "upc_e",
        "code_128",
        "code_39",
        "code_93",
        "itf",
        "codabar",
        "data_matrix",
      ],
    }) as unknown as Detector;
  })();
  return detectorPromise;
}

/**
 * Full-screen camera scanner. Calls onDetect once with the first code found.
 * Works on iPhone (Safari) and Android (Chrome) via a WebAssembly decoder.
 */
export function Scanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Type the code instead.");
        return;
      }
      try {
        const [stream, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
          getDetector(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchSupported(Boolean(caps.torch));

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes.find((c) => c.rawValue)?.rawValue;
              if (value && !doneRef.current) {
                doneRef.current = true;
                navigator.vibrate?.(60);
                stop();
                onDetectRef.current(value);
                return;
              }
            }
          } catch {
            // Ignore single-frame decode errors.
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        const name = (e as Error)?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow camera access for this site in your browser settings, or type the code instead."
            : name === "NotFoundError"
              ? "No camera found on this device. Type the code instead."
              : "Couldn't start the camera. Type the code instead.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [stop]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((t) => !t);
    } catch {
      setTorchSupported(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <span className="font-medium">Scan a barcode or QR code</span>
        <button
          type="button"
          aria-label="Close scanner"
          onClick={() => {
            stop();
            onClose();
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
        >
          <IconX />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-48 w-72 max-w-[80%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">Starting camera…</div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="max-w-xs text-sm">{error}</p>
          </div>
        )}
      </div>
      <div className="flex justify-center gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {torchSupported && (
          <Button variant="secondary" onClick={toggleTorch}>
            {torchOn ? "Light off" : "Light on"}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            stop();
            onClose();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Turns a scanned value into an item id if it's one of our QR labels. */
export function itemIdFromScan(value: string): string | null {
  try {
    const url = new URL(value);
    const m = url.pathname.match(/^\/i\/([0-9a-f-]{36})$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
