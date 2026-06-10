"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  CameraOffIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlipHorizontalIcon,
  LoaderCircleIcon,
  ScanLineIcon,
  UserXIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatShamsiTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { cn } from "@/lib/utils";
import {
  approveAndCheckinAction,
  checkinAction,
  scanQrAction,
  type CheckinActionResult,
  type ScanResult,
} from "@/app/(app)/my-events/[eventId]/checkin/actions";
import type { CheckinResolution } from "@/lib/events/checkin";

const DEDUPE_MS = 2500;
const LS_KEY = "kioar:checkin-camera-id";

type Phase =
  | { mode: "scanning" }
  | { mode: "resolving" }
  | { mode: "result"; resolution: CheckinResolution; scanned: string }
  | { mode: "acting" }
  | { mode: "done"; checkedInAt: string; alreadyCheckedIn: boolean; name: string }
  | { mode: "error"; message: string };

type CameraDevice = { deviceId: string; label: string };

/** Detect `BarcodeDetector` support without tripping TS (it's not in lib.dom). */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};
function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (
    globalThis as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export function CheckinScanner({
  eventId,
  timezone,
}: {
  eventId: string;
  timezone: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const activeRef = useRef(true);

  const [phase, setPhase] = useState<Phase>({ mode: "scanning" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const handleDecoded = useCallback(
    async (value: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === value && now - last.at < DEDUPE_MS) return;
      lastScanRef.current = { value, at: now };

      activeRef.current = false;
      setPhase({ mode: "resolving" });
      try {
        const res: ScanResult = await scanQrAction(eventId, value);
        if (!res.ok) {
          setPhase({ mode: "error", message: res.message });
          return;
        }
        setPhase({ mode: "result", resolution: res.resolution, scanned: value });
      } catch {
        setPhase({
          mode: "error",
          message: "اتصال برقرار نشد. دوباره تلاش کنید.",
        });
      }
    },
    [eventId],
  );

  // Start (or restart) the camera stream for a given deviceId.
  const startStream = useCallback(
    async (deviceId: string | null) => {
      // Tear down any existing stream first.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setCameraError(null);

      const videoConstraint: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "environment" } };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false,
        });
      } catch {
        setCameraError("دسترسی به دوربین ممکن نشد. اجازهٔ دوربین را بررسی کنید.");
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch (e) {
        // AbortError fires when a new stream replaces this one mid-play (camera
        // switch). Safe to ignore — the new startStream call handles playback.
        if (e instanceof DOMException && e.name === "AbortError") return;
        throw e;
      }
      detectorRef.current = getBarcodeDetector();

      // After first successful stream, enumerate devices — labels are now available.
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `دوربین ${i + 1}`,
        }));
      setCameras(videoInputs);

      // Track which camera is active.
      const activeTrack = stream.getVideoTracks()[0];
      const activeId = activeTrack?.getSettings().deviceId ?? null;
      setActiveCameraId(activeId);
      if (activeId) localStorage.setItem(LS_KEY, activeId);

      // Decode loop.
      activeRef.current = true;
      let frameInFlight = false;
      function loop() {
        const v = videoRef.current;
        if (v && v.readyState >= 2 && activeRef.current && !frameInFlight) {
          frameInFlight = true;
          decodeFrame(v).then((val) => {
            frameInFlight = false;
            if (val && activeRef.current) handleDecoded(val);
          });
        }
        rafRef.current = requestAnimationFrame(loop);
      }
      loop();
    },
    [handleDecoded],
  );

  async function decodeFrame(video: HTMLVideoElement): Promise<string | null> {
    const detector = detectorRef.current;
    if (detector) {
      try {
        const codes = await detector.detect(video);
        return codes[0]?.rawValue ?? null;
      } catch {
        // fall through to jsQR
      }
    }
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
    return code?.data ?? null;
  }

  // Initial mount: prefer saved deviceId, fall back to environment-facing.
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    startStream(saved);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = useCallback(
    (deviceId: string) => {
      localStorage.setItem(LS_KEY, deviceId);
      startStream(deviceId);
    },
    [startStream],
  );

  const resumeScanning = useCallback(() => {
    lastScanRef.current = null;
    activeRef.current = true;
    setPhase({ mode: "scanning" });
  }, []);

  const runAction = useCallback(
    async (
      fn: (eventId: string, registrationId: string) => Promise<CheckinActionResult>,
      registrationId: string,
      name: string,
    ) => {
      setPhase({ mode: "acting" });
      try {
        const result = await fn(eventId, registrationId);
        if (!result.ok) {
          setPhase({ mode: "error", message: result.message });
          return;
        }
        setPhase({
          mode: "done",
          checkedInAt: result.checkedInAt,
          alreadyCheckedIn: result.alreadyCheckedIn,
          name,
        });
      } catch {
        setPhase({
          mode: "error",
          message: "اتصال برقرار نشد. دوباره تلاش کنید.",
        });
      }
    },
    [eventId],
  );

  if (cameraError) {
    return (
      <div className="rounded-4xl border border-rose-200 bg-rose-50 p-6 text-center">
        <CameraOffIcon className="mx-auto mb-3 size-8 text-rose-500" />
        <p className="text-sm text-rose-700">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-4xl border border-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {phase.mode === "scanning" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-48 rounded-3xl border-2 border-white/80" />
            <ScanLineIcon className="absolute size-6 text-white/90" />
          </div>
        ) : null}

        {/* Camera switcher — only shown when multiple cameras are available */}
        {cameras.length > 1 ? (
          <div className="absolute bottom-3 end-3 flex flex-col items-end gap-1">
            {cameras.map((cam) => (
              <button
                key={cam.deviceId}
                type="button"
                onClick={() => switchCamera(cam.deviceId)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium shadow backdrop-blur-sm transition-colors",
                  cam.deviceId === activeCameraId
                    ? "bg-white text-black"
                    : "bg-black/50 text-white/80 hover:bg-black/70",
                )}
              >
                {cam.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Single-camera flip hint icon when only one camera */}
        {cameras.length === 1 ? null : cameras.length === 0 ? null : (
          <FlipHorizontalIcon className="absolute bottom-3 start-3 size-5 text-white/40" />
        )}
      </div>

      <ResultArea
        phase={phase}
        timezone={timezone}
        onResume={resumeScanning}
        onCheckin={(regId, name) => runAction(checkinAction, regId, name)}
        onApproveAndCheckin={(regId, name) =>
          runAction(approveAndCheckinAction, regId, name)
        }
      />
    </div>
  );
}

function ResultArea({
  phase,
  timezone,
  onResume,
  onCheckin,
  onApproveAndCheckin,
}: {
  phase: Phase;
  timezone: string;
  onResume: () => void;
  onCheckin: (registrationId: string, name: string) => void;
  onApproveAndCheckin: (registrationId: string, name: string) => void;
}) {
  if (phase.mode === "scanning") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        کد QR شخصی مهمان را مقابل دوربین بگیرید.
      </p>
    );
  }

  if (phase.mode === "resolving" || phase.mode === "acting") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        لطفاً صبر کنید…
      </div>
    );
  }

  if (phase.mode === "error") {
    return (
      <ResultCard tone="neutral" icon={<XCircleIcon className="size-7" />}>
        <p className="text-base font-semibold">{phase.message}</p>
        <Button onClick={onResume} className="mt-3 h-12 w-full">
          اسکن دوباره
        </Button>
      </ResultCard>
    );
  }

  if (phase.mode === "done") {
    return (
      <ResultCard tone="green" icon={<CheckCircle2Icon className="size-7" />}>
        <p className="text-lg font-bold">{phase.name}</p>
        <p className="mt-1 text-sm">
          {phase.alreadyCheckedIn
            ? `قبلاً وارد شده در ساعت ${toPersianDigits(
                formatShamsiTimeInZone(new Date(phase.checkedInAt), timezone),
              )}`
            : "ورود ثبت شد ✓"}
        </p>
        <Button onClick={onResume} className="mt-3 h-12 w-full">
          مهمان بعدی
        </Button>
      </ResultCard>
    );
  }

  // phase.mode === "result"
  return (
    <ResolutionCard
      resolution={phase.resolution}
      timezone={timezone}
      onResume={onResume}
      onCheckin={onCheckin}
      onApproveAndCheckin={onApproveAndCheckin}
    />
  );
}

function ResolutionCard({
  resolution,
  timezone,
  onResume,
  onCheckin,
  onApproveAndCheckin,
}: {
  resolution: CheckinResolution;
  timezone: string;
  onResume: () => void;
  onCheckin: (registrationId: string, name: string) => void;
  onApproveAndCheckin: (registrationId: string, name: string) => void;
}) {
  const r = resolution;

  switch (r.kind) {
    case "approved_ready":
      return (
        <ResultCard
          tone="green"
          icon={<CheckCircle2Icon className="size-7" />}
        >
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">تأیید شده — آمادهٔ ورود</p>
          <Button
            onClick={() => onCheckin(r.registrationId, r.displayName)}
            className="mt-3 h-12 w-full"
          >
            ثبت ورود
          </Button>
          <ResumeLink onResume={onResume} />
        </ResultCard>
      );

    case "already_checked_in":
      return (
        <ResultCard tone="blue" icon={<ClockIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">
            قبلاً وارد شده در ساعت{" "}
            {toPersianDigits(formatShamsiTimeInZone(r.checkedInAt, timezone))}
          </p>
          <Button onClick={onResume} className="mt-3 h-12 w-full">
            مهمان بعدی
          </Button>
        </ResultCard>
      );

    case "pending_approval":
      return (
        <ResultCard tone="amber" icon={<ClockIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">در انتظار تأیید میزبان</p>
          <Button
            onClick={() => onApproveAndCheckin(r.registrationId, r.displayName)}
            className="mt-3 h-12 w-full"
          >
            تأیید و ثبت ورود
          </Button>
          <ResumeLink onResume={onResume} label="رد و اسکن بعدی" />
        </ResultCard>
      );

    case "payment_pending":
    case "payment_submitted":
      return (
        <ResultCard tone="amber" icon={<ClockIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">
            {r.kind === "payment_submitted"
              ? "رسید ارسال شده — بررسی نشده"
              : "در انتظار پرداخت"}
          </p>
          <Button
            onClick={() => onApproveAndCheckin(r.registrationId, r.displayName)}
            className="mt-3 h-12 w-full"
          >
            تأیید رسید و ثبت ورود
          </Button>
          <ResumeLink onResume={onResume} label="رد و اسکن بعدی" />
        </ResultCard>
      );

    case "waitlisted":
      return (
        <ResultCard tone="red" icon={<XCircleIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">در فهرست انتظار — هنوز تأیید نشده</p>
          <Button
            onClick={() => onApproveAndCheckin(r.registrationId, r.displayName)}
            variant="outline"
            className="mt-3 h-12 w-full"
          >
            تأیید و ورود (override)
          </Button>
          <ResumeLink onResume={onResume} />
        </ResultCard>
      );

    case "rejected":
    case "cancelled":
      return (
        <ResultCard tone="red" icon={<XCircleIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">
            {r.kind === "rejected" ? "ثبت‌نام رد شده" : "ثبت‌نام لغو شده"} — ورود
            مجاز نیست
          </p>
          <Button onClick={onResume} className="mt-3 h-12 w-full">
            اسکن دوباره
          </Button>
        </ResultCard>
      );

    case "not_registered":
      return (
        <ResultCard tone="neutral" icon={<UserXIcon className="size-7" />}>
          <p className="text-lg font-bold">{r.displayName}</p>
          <p className="mt-1 text-sm">برای این رویداد ثبت‌نام نکرده است.</p>
          <Button onClick={onResume} className="mt-3 h-12 w-full">
            اسکن دوباره
          </Button>
        </ResultCard>
      );

    case "not_kioar_user":
    default:
      return (
        <ResultCard tone="neutral" icon={<UserXIcon className="size-7" />}>
          <p className="text-base font-semibold">
            این کد QR متعلق به کاربر کی‌یوآر نیست.
          </p>
          <Button onClick={onResume} className="mt-3 h-12 w-full">
            اسکن دوباره
          </Button>
        </ResultCard>
      );
  }
}

function ResumeLink({
  onResume,
  label = "رد کردن",
}: {
  onResume: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onResume}
      className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      {label}
    </button>
  );
}

const TONES: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-muted/40 text-foreground",
};

function ResultCard({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto max-w-sm rounded-4xl border p-6 text-center",
        TONES[tone],
      )}
    >
      <div className="mb-2 flex justify-center">{icon}</div>
      {children}
    </div>
  );
}
