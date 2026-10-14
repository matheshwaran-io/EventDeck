"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, Building2, CheckCircle2, Loader2, Send, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { processPayoutAction } from "@/app/actions/payouts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPaise } from "@/lib/format";
import type { AdminPayoutRow } from "@/lib/server/payouts";

export function ProcessPayoutDialog({
  payout,
  trigger,
}: {
  payout: AdminPayoutRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [utr, setUtr] = useState(
    payout.utr ||
      `CMS${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 899 + 100)}`,
  );
  const [notes, setNotes] = useState(payout.notes || "");
  const [error, setError] = useState<string | null>(null);

  const b = payout.beneficiarySnapshot;

  const handleAction = (action: "approve" | "reject") => {
    setError(null);
    startTransition(async () => {
      const res = await processPayoutAction({
        payoutId: payout.id,
        action,
        utr: action === "approve" ? utr : undefined,
        notes,
      });

      if (res.ok) {
        toast.success(res.message || "Payout updated!");
        setOpen(false);
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  const isDecided = payout.status === "completed" || payout.status === "rejected";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button size="sm" variant={isDecided ? "ghost" : "default"}>
              {isDecided ? "View Details" : "Disburse / Review"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {payout.reference}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                payout.status === "completed"
                  ? "bg-success-soft text-success"
                  : payout.status === "rejected"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning-soft text-warning"
              }`}
            >
              {payout.status}
            </span>
          </div>
          <DialogTitle>Settlement Disbursement</DialogTitle>
          <DialogDescription>
            {payout.eventTitle} · Organizer: {payout.organizerName} ({payout.organizerEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Beneficiary Details Card */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Beneficiary Bank Account</span>
              <span className="text-primary flex items-center gap-1 normal-case font-normal text-xs">
                {b.accountType === "upi" ? (
                  <>
                    <Smartphone className="size-3.5" /> UPI Transfer
                  </>
                ) : (
                  <>
                    <Building2 className="size-3.5" /> NEFT / IMPS
                  </>
                )}
              </span>
            </p>
            <div className="font-medium text-foreground text-base">{b.beneficiaryName}</div>
            {b.accountType === "upi" ? (
              <div className="font-mono text-xs text-muted-foreground">UPI ID: {b.upiId}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Bank:</span> {b.bankName || "Bank"}
                </div>
                <div>
                  <span className="text-muted-foreground">A/C:</span>{" "}
                  <span className="font-mono font-medium">{b.accountNumber}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">IFSC:</span>{" "}
                  <span className="font-mono font-medium">{b.ifscCode}</span>
                </div>
              </div>
            )}
          </div>

          {/* Amount Breakdown */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-center">
            <div>
              <p className="text-[0.6875rem] text-muted-foreground font-medium">Gross Sales</p>
              <p className="font-semibold text-foreground text-base mt-0.5">
                {formatPaise(payout.amountPaise)}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] text-muted-foreground font-medium">Platform Fee (5%)</p>
              <p className="font-semibold text-muted-foreground text-base mt-0.5">
                {formatPaise(payout.platformFeePaise)}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] text-primary font-medium">Net Disbursable</p>
              <p className="font-bold text-primary text-base mt-0.5">
                {formatPaise(payout.netAmountPaise)}
              </p>
            </div>
          </div>

          {/* Processing Inputs (If pending) */}
          {!isDecided ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Bank UTR / Transaction Reference Number
                </label>
                <Input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. CMS2026101400234 or UPI-9832104"
                  className="font-mono text-xs uppercase"
                  required
                />
                <p className="text-[0.6875rem] text-muted-foreground">
                  Simulated IMPS / RazorpayX transfer reference for sandbox settlements.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Admin Disbursement Notes (Optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Disbursed via campus finance office account."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1 text-muted-foreground">
              {payout.utr && (
                <p>
                  UTR / Reference: <strong className="font-mono text-foreground">{payout.utr}</strong>
                </p>
              )}
              {payout.processedByName && (
                <p>Processed By: <strong className="text-foreground">{payout.processedByName}</strong></p>
              )}
              {payout.notes && <p>Notes: {payout.notes}</p>}
            </div>
          )}

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Close
          </Button>
          {!isDecided && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="destructive"
                onClick={() => handleAction("reject")}
                disabled={pending}
                className="flex-1 sm:flex-none"
              >
                <XCircle className="size-4" /> Decline
              </Button>
              <Button
                onClick={() => handleAction("approve")}
                disabled={pending}
                className="flex-1 sm:flex-none"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Send className="size-4" /> Disburse Settlement
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
