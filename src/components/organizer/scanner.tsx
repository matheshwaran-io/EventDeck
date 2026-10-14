"use client";

import { AlertTriangle, Camera, CameraOff, CheckCircle2, Clock, Keyboard, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/status-badge";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type ScanTicket = { ticketNumber: string; attendeeName: string; tierName: string; bookingReference: string };
type Result =
  | { status: "checked_in"; ticket: ScanTicket; scannedAt: string }
  | { status: "already_used"; ticket: ScanTicket; scannedAt: string; scannedBy: string }
  | { status: "outside_window"; ticket: ScanTicket; message: string }
  | { status: "invalid"; message: string; ticket?: ScanTicket }
  | { status: "error"; message: string };

type CameraState = "idle" | "starting" | "scanning" | "error";

const READER_ID = "qr-reader";

export function Scanner({
  eventId,
  initialCount,
  windowState,
  windowLabel,
}: {
  eventId: string;
  initialCount: number;
  windowState: "open" | "before" | "after" | "cancelled";
  windowLabel: string;
}) {
  const [camera, setCamera] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [manual, setManual] = useState("");
  const [history, setHistory] = useState<{ key: number; result: Result; at: Date }[]>([]);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const busy = useRef(false);

  const submit = useCallback(
    async (code: string, method: "qr" | "manual") => {
      if (busy.current) return;
      const now = Date.now();
      if (method === "qr" && lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 4000) return;
      lastCode.current = { code, at: now };
      busy.current = true;
      setChecking(true);
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, code, method }),
        });
        const json = await res.json();
        const r: Result = res.ok ? json : { status: "error", message: json.error ?? "Check-in failed" };
        setResult(r);
        setHistory((h) => [{ key: now, result: r, at: new Date() }, ...h].slice(0, 8));
        if (r.status === "checked_in") setCount((c) => c + 1);
        if ("vibrate" in navigator) navigator.vibrate(r.status === "checked_in" ? 60 : [80, 60, 80]);
      } catch {
        setResult({ status: "error", message: "Network error — check your connection and scan again." });
      } finally {
        busy.current = false;
        setChecking(false);
      }
    },
    [eventId],
  );

  // Auto-dismiss the result card so the next guest can be scanned.
  useEffect(() => {
    if (!result || camera !== "scanning") return;
    const t = setTimeout(() => setResult(null), result.status === "checked_in" ? 2200 : 3500);
    return () => clearTimeout(t);
  }, [result, camera]);

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setCamera("idle");
  }, []);

  useEffect(() => () => void stop(), [stop]);

  const startCamera = async () => {
    setCameraError(null);
    if (!window.isSecureContext) {
      setCamera("error");
      setCameraError("Camera access needs HTTPS. Open this page over https:// (or localhost), or use manual entry below.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("error");
      setCameraError("This browser can't access the camera. Try Chrome or Safari, or use manual entry below.");
      return;
    }
    setCamera("starting");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const s = new Html5Qrcode(READER_ID, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w, h) => {
          const size = Math.floor(Math.min(w, h) * 0.7);
          return { width: size, height: size };
        }, aspectRatio: 1 },
        (text) => void submit(text, "qr"),
        () => undefined,
      );
      setCamera("scanning");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCamera("error");
      setCameraError(
        /NotAllowed|Permission/i.test(msg)
          ? "Camera permission was denied. Allow camera access in your browser's site settings (the lock icon in the address bar), then try again."
          : /NotFound|Requested device not found/i.test(msg)
            ? "No camera was found on this device. Use manual entry below."
            : /NotReadable|in use/i.test(msg)
              ? "The camera is being used by another app. Close it and try again."
              : "Couldn't start the camera. Use manual entry below, or reload and try again.",
      );
      await stop().catch(() => undefined);
      setCamera("error");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr]">
      <div className="space-y-4">
        {windowState !== "open" && (
          <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {windowState === "before" ? "Check-in hasn't opened yet" : windowState === "after" ? "Check-in has closed" : "Event cancelled"}
              </p>
              <p className="text-foreground/75">Window: {windowLabel}. Scans outside the window are refused.</p>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl bg-foreground text-background shadow-[var(--shadow-lift)]">
          <div className="relative aspect-square w-full">
            <div id={READER_ID} className="absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
            {camera !== "scanning" && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                {camera === "starting" ? (
                  <div className="space-y-3">
                    <Loader2 className="mx-auto size-6 animate-spin" />
                    <p className="text-sm text-background/70">Waiting for camera permission…</p>
                  </div>
                ) : camera === "error" ? (
                  <div className="space-y-4">
                    <CameraOff className="mx-auto size-8 text-signal" />
                    <p className="text-sm text-background/80">{cameraError}</p>
                    <Button variant="signal" onClick={startCamera}>
                      <RotateCcw /> Try again
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto grid size-14 place-items-center rounded-full bg-background/10">
                      <Camera className="size-6" />
                    </div>
                    <div>
                      <p className="font-medium">Scan tickets with your camera</p>
                      <p className="mt-1 text-sm text-background/60">We&apos;ll ask for camera permission. Video never leaves your device.</p>
                    </div>
                    <Button variant="signal" size="lg" onClick={startCamera}>
                      <Camera /> Start scanning
                    </Button>
                  </div>
                )}
              </div>
            )}
            {camera === "scanning" && !result && (
              <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-background/70">
                <div className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-signal shadow-[0_0_12px_var(--signal)] [--scan-size:100%] motion-safe:animate-[scan-line_2.4s_ease-in-out_infinite]" />
              </div>
            )}
            {checking && (
              <div className="absolute inset-0 grid place-items-center bg-foreground/40">
                <Loader2 className="size-8 animate-spin" />
              </div>
            )}
            {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}
          </div>
          <div className="flex items-center justify-between border-t border-background/10 px-4 py-3 text-sm">
            <span className="text-background/70">
              Checked in: <span className="font-semibold text-background tabular">{count}</span>
            </span>
            {camera === "scanning" && (
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/10 hover:text-background" onClick={() => void stop()}>
                Stop camera
              </Button>
            )}
          </div>
        </div>

        <form
          className="surface flex gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void submit(manual.trim(), "manual").then(() => setManual(""));
          }}
        >
          <div className="relative flex-1">
            <Keyboard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Ticket number"
              placeholder="Type a ticket number, e.g. HN2-AB3C-DE4F"
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              className="pl-9 font-mono"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!manual.trim() || checking}>
            Check in
          </Button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">This session</h2>
        {history.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Scans will appear here.</p>
        ) : (
          <ul className="surface mt-3 divide-y">
            {history.map((h) => (
              <li key={h.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                <ResultIcon status={h.result.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{"ticket" in h.result && h.result.ticket ? h.result.ticket.attendeeName : "Unknown ticket"}</p>
                  <p className="truncate text-xs text-muted-foreground">{label(h.result)}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular">{formatTime(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 rounded-xl bg-secondary p-4 text-xs leading-relaxed text-muted-foreground">
          Every scan is validated on the server: the ticket must be approved, belong to this event, and be inside the check-in window. A ticket can
          only be checked in once — even across multiple scanning phones.
        </div>
      </div>
    </div>
  );
}

function label(r: Result) {
  switch (r.status) {
    case "checked_in":
      return `Checked in · ${r.ticket.tierName}`;
    case "already_used":
      return `Already used at ${formatTime(new Date(r.scannedAt))}`;
    case "outside_window":
      return r.message;
    default:
      return r.message;
  }
}

function ResultIcon({ status }: { status: Result["status"] }) {
  if (status === "checked_in") return <CheckCircle2 className="size-5 shrink-0 text-success" />;
  if (status === "already_used") return <AlertTriangle className="size-5 shrink-0 text-warning" />;
  if (status === "outside_window") return <Clock className="size-5 shrink-0 text-warning" />;
  return <XCircle className="size-5 shrink-0 text-destructive" />;
}

function ResultCard({ result, onDismiss }: { result: Result; onDismiss: () => void }) {
  const tone =
    result.status === "checked_in" ? "bg-success" : result.status === "already_used" || result.status === "outside_window" ? "bg-[oklch(0.62_0.13_70)]" : "bg-destructive";
  const title =
    result.status === "checked_in"
      ? "Welcome in"
      : result.status === "already_used"
        ? "Already checked in"
        : result.status === "outside_window"
          ? "Outside check-in window"
          : "Not valid";
  const ticket = "ticket" in result ? result.ticket : undefined;
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn("absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95", tone)}
      aria-live="assertive"
    >
      {result.status === "checked_in" ? (
        <CheckCircle2 className="size-14" strokeWidth={1.5} />
      ) : result.status === "already_used" || result.status === "outside_window" ? (
        <AlertTriangle className="size-14" strokeWidth={1.5} />
      ) : (
        <XCircle className="size-14" strokeWidth={1.5} />
      )}
      <p className="font-display text-[2.25rem] leading-none">{title}</p>
      {ticket && (
        <div className="space-y-1">
          <p className="text-lg font-semibold">{ticket.attendeeName}</p>
          <p className="text-sm opacity-85">
            {ticket.tierName} · <span className="font-mono">{ticket.ticketNumber}</span>
          </p>
        </div>
      )}
      <p className="max-w-xs text-sm opacity-90">
        {result.status === "already_used"
          ? `First scanned at ${formatTime(new Date(result.scannedAt))} by ${result.scannedBy}.`
          : result.status === "checked_in"
            ? null
            : result.message}
      </p>
      <StatusBadge tone="neutral" className="bg-white/20 text-white ring-white/30">
        Tap to continue
      </StatusBadge>
    </button>
  );
}
