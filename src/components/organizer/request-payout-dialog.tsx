"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Banknote, Building2, CheckCircle2, HelpCircle, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { requestPayoutAction } from "@/app/actions/payouts";
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
import type { OrganizerPayoutAccount } from "@/db/schema";
import { formatPaise } from "@/lib/format";
import { PLATFORM_FEE_RATE, PLATFORM_FEE_PERCENT } from "@/lib/validation/payouts";

export function RequestPayoutDialog({
  event,
  account,
  trigger,
}: {
  event: { id: string; title: string; availablePaise: number };
  account: OrganizerPayoutAccount | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const availableRupees = Math.floor(event.availablePaise / 100);
  const [amountRupees, setAmountRupees] = useState<number>(availableRupees);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numAmount = Number(amountRupees) || 0;
  const feeRupees = Math.round(numAmount * PLATFORM_FEE_RATE);
  const netRupees = Math.max(0, numAmount - feeRupees);

  const handleMaxClick = () => {
    setAmountRupees(availableRupees);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError("Please set up your Bank or UPI payout account first.");
      return;
    }

    if (numAmount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }

    if (numAmount > availableRupees) {
      setError(`Amount cannot exceed available event balance of ₹${availableRupees.toLocaleString("en-IN")}.`);
      return;
    }

    startTransition(async () => {
      const res = await requestPayoutAction({
        eventId: event.id,
        amountRupees: numAmount,
        notes,
      });

      if (res.ok) {
        toast.success(res.message || "Payout request submitted!");
        setOpen(false);
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button size="sm" disabled={event.availablePaise <= 0}>
              <Banknote className="size-4" /> Request Payout
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Settlement Payout</DialogTitle>
          <DialogDescription>
            Withdraw ticket revenue for <strong className="text-foreground">{event.title}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Destination Preview */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Settlement Destination
            </p>
            {account ? (
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {account.accountType === "upi" ? (
                    <Smartphone className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Building2 className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="font-medium truncate">{account.beneficiaryName}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {account.accountType === "upi"
                      ? `(${account.upiId})`
                      : `(${account.bankName || "Bank"} ·•••${account.accountNumber?.slice(-4)})`}
                  </span>
                </div>
                <span className="text-[0.6875rem] text-success font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Verified
                </span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-destructive">
                No payout account configured. Please save your bank/UPI details first.
              </p>
            )}
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Payout Amount (₹)</label>
              <button
                type="button"
                onClick={handleMaxClick}
                className="text-xs text-primary hover:underline font-medium"
              >
                Max: ₹{availableRupees.toLocaleString("en-IN")}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                ₹
              </span>
              <Input
                type="number"
                min={1}
                max={availableRupees}
                value={amountRupees || ""}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                className="pl-8 text-base font-semibold"
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Fee & Net Breakdown */}
          <div className="rounded-lg border border-border/80 bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Gross Withdrawal</span>
              <span>₹{numAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Service Fee (5%)</span>
              <span>-₹{feeRupees.toLocaleString("en-IN")}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between font-semibold text-foreground text-sm">
              <span>Estimated Net Settlement</span>
              <span className="text-primary">₹{netRupees.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Notes for Administrator (Optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Festival stage vendor settlement or final club balance."
              rows={2}
            />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !account || availableRupees <= 0}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Submit Request <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
