"use client";

import { useState, useTransition } from "react";
import { Building2, Landmark, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { savePayoutAccountAction } from "@/app/actions/payouts";
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
import type { OrganizerPayoutAccount } from "@/db/schema";

export function PayoutAccountForm({
  existing,
  trigger,
}: {
  existing: OrganizerPayoutAccount | null;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [accountType, setAccountType] = useState<"bank_account" | "upi">(
    (existing?.accountType as "bank_account" | "upi") || "bank_account",
  );
  const [beneficiaryName, setBeneficiaryName] = useState(existing?.beneficiaryName || "");
  const [bankName, setBankName] = useState(existing?.bankName || "");
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber || "");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(existing?.accountNumber || "");
  const [ifscCode, setIfscCode] = useState(existing?.ifscCode || "");
  const [upiId, setUpiId] = useState(existing?.upiId || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await savePayoutAccountAction({
        accountType,
        beneficiaryName,
        bankName,
        accountNumber,
        confirmAccountNumber,
        ifscCode: ifscCode.toUpperCase(),
        upiId,
      });

      if (res.ok) {
        toast.success(res.message || "Payout account details saved!");
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
            <Button variant={existing ? "outline" : "default"} size="sm">
              <Landmark className="size-4" />
              {existing ? "Edit Payout Account" : "Add Bank / UPI Details"}
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Organizer Payout Destination</DialogTitle>
          <DialogDescription>
            Where funds collected from ticket sales will be transferred after your event.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Method selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountType("bank_account")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                accountType === "bank_account"
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Building2 className="size-4" /> Bank Account
            </button>
            <button
              type="button"
              onClick={() => setAccountType("upi")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                accountType === "upi"
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Smartphone className="size-4" /> UPI ID (VPA)
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Account Holder / Beneficiary Name *
            </label>
            <Input
              required
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              placeholder="e.g. SRM Tech Society or Full Name"
            />
          </div>

          {accountType === "bank_account" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Bank Name</label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India, HDFC Bank"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Account Number *</label>
                  <Input
                    required
                    type="password"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="8-20 digit account no."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Confirm Account No. *</label>
                  <Input
                    required
                    type="text"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    placeholder="Re-enter account no."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">IFSC Code *</label>
                <Input
                  required
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  className="font-mono uppercase"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">UPI ID (Virtual Payment Address) *</label>
              <Input
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. clubname@okhdfcbank or 9876543210@upi"
                className="font-mono"
              />
            </div>
          )}

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
            <span>
              <strong>Simulated Verification Active:</strong> No physical bank documents or live KYC
              required. Account is verified automatically in sandbox mode.
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save & Verify Account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
