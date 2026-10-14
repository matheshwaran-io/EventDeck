"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Gift, Loader2, Minus, Plus, ShieldCheck, TicketCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBookingAction } from "@/app/actions/bookings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HOLD_MINUTES } from "@/lib/constants";
import { formatDateTime, formatPaise } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tier = { id: string; name: string; description: string; pricePaise: number; remaining: number; capacity: number };

export function TicketSelector({
  event,
  tiers,
  viewer,
  closed,
}: {
  event: { id: string; slug: string; status: string; maxPerBooking: number; registrationClosesAt: string; allowPassRequests: boolean };
  tiers: Tier[];
  viewer: { name: string; eligible: boolean; held: number; isOwner: boolean } | null;
  closed: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [names, setNames] = useState<string[]>([]);
  const [showNames, setShowNames] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const total = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty]);
  const amount = useMemo(() => tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.pricePaise, 0), [qty, tiers]);
  const limit = Math.max(0, event.maxPerBooking - (viewer?.held ?? 0));
  const soldOut = tiers.every((t) => t.remaining === 0);

  const blocked: string | null =
    event.status === "cancelled"
      ? "This event has been cancelled."
      : event.status === "draft"
        ? "This event isn't published yet."
        : closed
          ? "Registration has closed."
          : soldOut
            ? "Sold out."
            : viewer && !viewer.eligible
              ? "Your participant category isn't eligible for this event."
              : viewer && limit === 0
                ? `You already hold the maximum of ${event.maxPerBooking} ticket(s) for this event.`
                : null;

  const change = (tier: Tier, delta: number) => {
    setQty((prev) => {
      const current = prev[tier.id] ?? 0;
      const next = Math.max(0, Math.min(current + delta, tier.remaining, current + (limit - total)));
      return { ...prev, [tier.id]: next };
    });
  };

  const submit = (passReason?: string) => {
    if (!viewer) {
      router.push(`/login?next=/events/${event.slug}`);
      return;
    }
    const lines = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([tierId, quantity]) => ({ tierId, quantity }));
    startTransition(async () => {
      const res = await createBookingAction({
        eventId: event.id,
        idempotencyKey: passReason !== undefined ? `${idempotencyKey}-pass` : idempotencyKey,
        lines,
        attendeeNames: names.slice(0, total),
        passReason,
      });
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      setPassOpen(false);
      toast.success(
        res.data!.status === "awaiting_payment"
          ? `Seats held for ${HOLD_MINUTES} minutes — complete payment to confirm.`
          : passReason !== undefined
            ? "Pass request sent to the organizer."
            : "Registration submitted for organizer approval.",
      );
      router.push(`/my/bookings/${res.data!.bookingId}`);
    });
  };

  const submitPass = () => {
    const r = reason.trim();
    if (r.length < 10) return setReasonError("Tell the organizer why you're eligible (10+ characters).");
    if (r.length > 500) return setReasonError("Keep it under 500 characters.");
    setReasonError(null);
    submit(r);
  };

  return (
    <div className="surface overflow-hidden">
      <div className="border-b px-5 py-4">
        <p className="font-semibold">Tickets</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Up to {event.maxPerBooking} per person · closes {formatDateTime(new Date(event.registrationClosesAt))}
        </p>
      </div>

      <ul className="divide-y">
        {tiers.map((t) => {
          const q = qty[t.id] ?? 0;
          const out = t.remaining === 0;
          return (
            <li key={t.id} className={cn("flex items-center gap-4 px-5 py-4 transition-colors", q > 0 && "bg-signal-soft/40")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm font-semibold tabular">{formatPaise(t.pricePaise)}</p>
                </div>
                {t.description && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t.description}</p>}
                <p className={cn("mt-1 text-xs", out ? "text-destructive" : t.remaining <= 10 ? "text-signal" : "text-muted-foreground")}>
                  {out ? "Sold out" : `${t.remaining} of ${t.capacity} left`}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full border bg-card p-0.5" role="group" aria-label={`${t.name} quantity`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={`Remove one ${t.name}`}
                  disabled={q === 0 || pending || Boolean(blocked)}
                  onClick={() => change(t, -1)}
                >
                  <Minus />
                </Button>
                <span className="w-6 text-center text-sm font-semibold tabular" aria-live="polite">
                  {q}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={`Add one ${t.name}`}
                  disabled={out || pending || Boolean(blocked) || q >= t.remaining || total >= limit}
                  onClick={() => change(t, 1)}
                >
                  <Plus />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {total > 0 && (
        <div className="border-t px-5 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium"
            onClick={() => setShowNames((s) => !s)}
            aria-expanded={showNames}
          >
            Attendee names <span className="text-xs font-normal text-muted-foreground">optional</span>
            <ChevronDown className={cn("size-4 transition-transform", showNames && "rotate-180")} />
          </button>
          {showNames && (
            <div className="mt-3 space-y-2">
              {Array.from({ length: total }, (_, i) => (
                <Input
                  key={i}
                  aria-label={`Attendee ${i + 1} name`}
                  placeholder={i === 0 && viewer ? viewer.name : `Attendee ${i + 1}`}
                  maxLength={80}
                  value={names[i] ?? ""}
                  onChange={(e) =>
                    setNames((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
              <p className="text-xs text-muted-foreground">Each attendee gets their own ticket and QR code.</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 border-t bg-secondary/40 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "ticket" : "tickets"}
          </span>
          <span className="text-xl font-semibold tabular">{amount === 0 && total > 0 ? "Free" : formatPaise(amount)}</span>
        </div>

        {blocked ? (
          <p className="rounded-lg bg-card px-3 py-2.5 text-center text-sm font-medium text-muted-foreground ring-1 ring-border">{blocked}</p>
        ) : !viewer ? (
          <Link href={`/login?next=/events/${event.slug}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
            Sign in to book
          </Link>
        ) : (
          <Button size="lg" className="w-full" disabled={total === 0 || pending} onClick={() => submit()}>
            {pending ? <Loader2 className="animate-spin" /> : <TicketCheck />}
            {total === 0 ? "Select tickets" : amount > 0 ? `Reserve & pay ${formatPaise(amount)}` : "Request registration"}
          </Button>
        )}

        {!blocked && viewer && event.allowPassRequests && (
          <Button variant="ghost" size="sm" className="w-full" disabled={total === 0 || pending} onClick={() => setPassOpen(true)}>
            <Gift /> Request a complimentary pass instead
          </Button>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          {amount > 0
            ? `Seats are held for ${HOLD_MINUTES} minutes while you pay (Razorpay Test Mode). Tickets activate once the organizer verifies your booking.`
            : "Tickets activate once the organizer verifies your registration."}
        </p>
      </div>

      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a complimentary pass</DialogTitle>
            <DialogDescription>
              For {total} {total === 1 ? "seat" : "seats"} in your selection. The organizer reviews every request; approved passes are free.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="pass-reason" className="text-[0.8125rem] font-medium">
              Why are you eligible?
            </label>
            <Textarea
              id="pass-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I'm volunteering at the registration desk / speaking / press"
              aria-invalid={Boolean(reasonError)}
              maxLength={500}
            />
            <div className="flex justify-between text-xs">
              <span className="font-medium text-destructive" role="alert">{reasonError}</span>
              <span className="text-muted-foreground tabular">{reason.length}/500</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPassOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitPass} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
