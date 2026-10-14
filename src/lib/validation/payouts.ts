import { z } from "zod";

export const PLATFORM_FEE_PERCENT = 5; // 5% platform fee deduction for organizers
export const PLATFORM_FEE_RATE = 0.05; // Decimal rate (0.05)

export const payoutAccountSchema = z
  .object({
    accountType: z.enum(["bank_account", "upi"]),
    beneficiaryName: z.string().trim().min(2, "Enter account holder / beneficiary name").max(120),
    bankName: z.string().trim().max(100).optional().default(""),
    accountNumber: z.string().trim().optional().default(""),
    confirmAccountNumber: z.string().trim().optional().default(""),
    ifscCode: z.string().trim().toUpperCase().optional().default(""),
    upiId: z.string().trim().toLowerCase().optional().default(""),
  })
  .refine(
    (data) => {
      if (data.accountType === "bank_account") {
        return Boolean(data.accountNumber && data.accountNumber.length >= 8 && data.accountNumber.length <= 20);
      }
      return true;
    },
    { path: ["accountNumber"], message: "Enter a valid bank account number (8-20 digits)" },
  )
  .refine(
    (data) => {
      if (data.accountType === "bank_account" && data.accountNumber) {
        return data.accountNumber === data.confirmAccountNumber;
      }
      return true;
    },
    { path: ["confirmAccountNumber"], message: "Account numbers do not match" },
  )
  .refine(
    (data) => {
      if (data.accountType === "bank_account") {
        return Boolean(data.ifscCode && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.ifscCode));
      }
      return true;
    },
    { path: ["ifscCode"], message: "Enter a valid 11-character IFSC code (e.g. SBIN0001234)" },
  )
  .refine(
    (data) => {
      if (data.accountType === "upi") {
        return Boolean(data.upiId && /^[\w.-]+@[\w.-]+$/.test(data.upiId));
      }
      return true;
    },
    { path: ["upiId"], message: "Enter a valid UPI ID (e.g. name@okhdfcbank or club@upi)" },
  );

export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

export const requestPayoutSchema = z.object({
  eventId: z.string().uuid("Invalid event"),
  amountRupees: z.coerce.number().min(1, "Minimum payout request is ₹1").max(500000, "Maximum single payout is ₹5,00,000"),
  notes: z.string().trim().max(300).optional().default(""),
});

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const processPayoutSchema = z.object({
  payoutId: z.string().uuid("Invalid payout ID"),
  action: z.enum(["approve", "reject"]),
  utr: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type ProcessPayoutInput = z.infer<typeof processPayoutSchema>;
