"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { CreditCard, FlaskConical, Loader2, TimerReset, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cancelBookingAction } from "@/app/actions/bookings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

type Order = {
  provider: "razorpay" | "mock";
  keyId: string | null;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  bookingReference: string;
  eventTitle: string;
  expiresAt: string;
  prefill: { name: string; email: string };
};

type RazorpayInstance = { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

function useCountdown(expiresAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

export function CheckoutPanel({
  bookingId,
  amountPaise,
  expiresAt,
  paymentFailed,
}: {
  bookingId: string;
  amountPaise: number;
  expiresAt: string;
  paymentFailed: boolean;
}) {
  const router = useRouter();
  const left = useCountdown(expiresAt);
  const [busy, setBusy] = useState<"pay" | "cancel" | "verify" | null>(null);
  const [mockOrder, setMockOrder] = useState<Order | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const expired = left <= 0;
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);

  useEffect(() => {
    if (expired) {
      const t = setTimeout(() => router.refresh(), 1200);
      return () => clearTimeout(t);
    }
  }, [expired, router]);

  const finish = (outcome: string) => {
    if (outcome === "exception") toast.warning("Payment received after your hold lapsed. An administrator will follow up.");
    else toast.success("Payment received. The organizer will verify your booking shortly.");
    router.refresh();
  };

  const pay = async () => {
    setBusy("pay");
    try {
      const order = await post<Order>("/api/payments/order", { bookingId });
      if (order.provider === "mock") {
        setMockOrder(order);
        setBusy(null);
        return;
      }
      if (!window.Razorpay) throw new Error("Payment window failed to load. Check your connection and try again.");
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "EventDeck",
        description: `${order.eventTitle} · ${order.bookingReference}`,
        prefill: order.prefill,
        theme: { color: "#2a2520" },
        modal: {
          ondismiss: () => {
            setBusy(null);
            toast("Payment window closed. Your seats stay held until the timer runs out.");
          },
        },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setBusy("verify");
          try {
            const r = await post<{ outcome: string }>("/api/payments/verify", resp);
            finish(r.outcome);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification failed");
            router.refresh();
          } finally {
            setBusy(null);
          }
        },
      });
      rzp.on("payment.failed", (resp) => {
        void post("/api/payments/failed", { orderId: order.orderId, reason: resp.error?.description ?? "Payment failed" })
          .catch(() => undefined)
          .finally(() => router.refresh());
        toast.error(resp.error?.description ?? "Payment failed. You can try again.");
      });
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start payment");
      setBusy(null);
      router.refresh();
    }
  };

  const simulate = async (outcome: "success" | "failure") => {
    if (!mockOrder) return;
    setBusy("verify");
    try {
      const r = await post<{ outcome: string }>("/api/payments/mock", { orderId: mockOrder.orderId, outcome });
      setMockOrder(null);
      if (outcome === "failure") {
        toast.error("Simulated payment declined. You can retry while seats are held.");
        router.refresh();
      } else finish(r.outcome);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    const res = await cancelBookingAction(bookingId);
    setBusy(null);
    setConfirmCancel(false);
    if (res.ok) {
      toast.success(res.message ?? "Booking cancelled");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <div className="surface overflow-hidden">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="flex items-center justify-between gap-4 border-b bg-warning-soft/60 px-5 py-4">
        <div>
          <p className="font-semibold">{expired ? "Reservation expired" : "Seats held for you"}</p>
          <p className="text-sm text-muted-foreground">
            {expired ? "Releasing your seats…" : "Pay before the timer ends to keep them."}
          </p>
        </div>
        <div
          className={cn("flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 font-mono text-lg font-semibold tabular ring-1 ring-border", left < 120_000 && "text-destructive")}
          role="timer"
          aria-label={`${mins} minutes ${secs} seconds left`}
        >
          <TimerReset className="size-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <div className="space-y-3 p-5">
        {paymentFailed && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">Your last payment attempt didn&apos;t go through. You can try again.</p>
        )}
        <Button size="lg" className="w-full" onClick={pay} disabled={expired || busy !== null}>
          {busy === "pay" || busy === "verify" ? <Loader2 className="animate-spin" /> : <CreditCard />}
          {busy === "verify" ? "Verifying payment…" : `Pay ${formatPaise(amountPaise)}`}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setConfirmCancel(true)} disabled={busy !== null || expired}>
          <X /> Cancel booking
        </Button>
        <p className="text-center text-xs text-muted-foreground">Razorpay Test Mode — use test cards only. No real money is charged.</p>
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this booking?</DialogTitle>
            <DialogDescription>Your held seats will be released immediately. You can book again if seats remain.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={busy === "cancel"}>
              {busy === "cancel" && <Loader2 className="animate-spin" />} Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mockOrder !== null} onOpenChange={(o) => !o && busy === null && setMockOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-full bg-info-soft text-info">
              <FlaskConical className="size-5" />
            </div>
            <DialogTitle>Test payment simulator</DialogTitle>
            <DialogDescription>
              Razorpay keys aren&apos;t configured in this environment, so payments are simulated locally. The result goes through the same
              server-side confirmation as a real Test Mode payment.
            </DialogDescription>
          </DialogHeader>
          {mockOrder && (
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-secondary p-4 text-sm">
              <dt className="text-muted-foreground">Order</dt>
              <dd className="truncate text-right font-mono text-xs">{mockOrder.orderId}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right font-semibold tabular">{formatPaise(mockOrder.amountPaise)}</dd>
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => simulate("failure")} disabled={busy !== null}>
              Simulate decline
            </Button>
            <Button onClick={() => simulate("success")} disabled={busy !== null}>
              {busy === "verify" && <Loader2 className="animate-spin" />} Simulate success
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CancelRequestButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <X /> Withdraw request
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this request?</DialogTitle>
            <DialogDescription>The seats you requested will be released for others.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep request
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await cancelBookingAction(bookingId);
                setBusy(false);
                setOpen(false);
                if (res.ok) {
                  toast.success("Request withdrawn");
                  router.refresh();
                } else toast.error(res.error);
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
