"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { BookingStatus, PaymentStatus, RefundStatus } from "@/db/schema";
import { decideBookingAction } from "@/app/actions/bookings";
import { BookingBadges } from "@/components/bookings/booking-badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { participantLabel } from "@/lib/constants";
import { formatPaise, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  reference: string;
  kind: "paid" | "free" | "complimentary";
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  quantity: number;
  amountPaise: number;
  attendeeNames: string[];
  passReason: string | null;
  decisionNote: string | null;
  createdAt: string;
  buyer: { fullName: string; email: string; category: Parameters<typeof participantLabel>[0]; institution: string | null };
  tiers: string;
  paymentRef: string | null;
};

export function BookingQueue({ rows, canDecide }: { rows: Row[]; canDecide: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const decide = (row: Row, decision: "approve" | "reject", n?: string) => {
    setBusyId(row.id);
    start(async () => {
      const res = await decideBookingAction({ bookingId: row.id, decision, note: n });
      setBusyId(null);
      if (res.ok) {
        toast.success(`${row.reference}: ${res.message}`);
        setDone((d) => new Set(d).add(row.id));
        setRejecting(null);
        setNote("");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => {
          const decidable = canDecide && r.status === "pending_verification" && !done.has(r.id);
          const expanded = open === r.id;
          return (
            <li key={r.id} className={cn("surface overflow-hidden transition-opacity", done.has(r.id) && "opacity-50")}>
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  onClick={() => setOpen(expanded ? null : r.id)}
                  aria-expanded={expanded}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{r.quantity}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{r.buyer.fullName}</span>
                      <span className="text-xs text-muted-foreground">{participantLabel(r.buyer.category)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {r.tiers} · {r.amountPaise ? formatPaise(r.amountPaise) : r.kind === "complimentary" ? "Complimentary" : "Free"} ·{" "}
                      <span className="font-mono text-xs">{r.reference}</span>
                    </span>
                  </span>
                  <ChevronDown className={cn("mt-2 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </button>
                <div className="flex items-center gap-2 sm:justify-end">
                  {decidable ? (
                    <>
                      <Button variant="destructive-outline" size="sm" disabled={pending} onClick={() => setRejecting(r)}>
                        <X /> Reject
                      </Button>
                      <Button size="sm" disabled={pending} onClick={() => decide(r, "approve")}>
                        {busyId === r.id ? <Loader2 className="animate-spin" /> : <Check />} Approve
                      </Button>
                    </>
                  ) : (
                    <BookingBadges booking={r} compact />
                  )}
                </div>
              </div>
              {expanded && (
                <dl className="grid gap-4 border-t bg-secondary/30 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="eyebrow text-[0.625rem]">Contact</dt>
                    <dd className="mt-1 break-all">{r.buyer.email}</dd>
                    {r.buyer.institution && <dd className="text-muted-foreground">{r.buyer.institution}</dd>}
                  </div>
                  <div>
                    <dt className="eyebrow text-[0.625rem]">Attendees</dt>
                    <dd className="mt-1">{r.attendeeNames.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-[0.625rem]">Payment</dt>
                    <dd className="mt-1">
                      {r.kind === "paid" ? (r.paymentRef ? <span className="font-mono text-xs">{r.paymentRef}</span> : r.paymentStatus) : "Not required"}
                    </dd>
                    <dd className="text-xs text-muted-foreground">Requested {relativeTime(new Date(r.createdAt))}</dd>
                  </div>
                  {r.passReason && (
                    <div className="sm:col-span-3">
                      <dt className="eyebrow text-[0.625rem]">Pass request reason</dt>
                      <dd className="mt-1 rounded-lg bg-card p-3 ring-1 ring-border">{r.passReason}</dd>
                    </div>
                  )}
                  {r.decisionNote && (
                    <div className="sm:col-span-3">
                      <dt className="eyebrow text-[0.625rem]">Decision note</dt>
                      <dd className="mt-1">{r.decisionNote}</dd>
                    </div>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.reference}?</DialogTitle>
            <DialogDescription>
              {rejecting?.paymentStatus === "paid"
                ? "This booking is paid. Rejecting releases the seats and flags the payment for an administrator — refunds are not issued automatically for individual bookings."
                : "The seats are released and the participant is notified."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="reject-note" className="text-[0.8125rem] font-medium">
              Reason (shared with the participant)
            </label>
            <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Back
            </Button>
            <Button variant="destructive" disabled={pending || note.trim().length < 3} onClick={() => rejecting && decide(rejecting, "reject", note)}>
              {pending && <Loader2 className="animate-spin" />} Reject booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
