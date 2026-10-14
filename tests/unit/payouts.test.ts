import { describe, expect, it } from "vitest";
import {
  payoutAccountSchema,
  requestPayoutSchema,
  processPayoutSchema,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
} from "@/lib/validation/payouts";

const sampleUuid = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";

describe("payout validation schemas", () => {
  describe("payoutAccountSchema", () => {
    it("validates a valid Indian bank account", () => {
      const validBank = {
        accountType: "bank_account",
        beneficiaryName: "Maddy Organizer",
        bankName: "HDFC Bank",
        accountNumber: "50100234567890",
        confirmAccountNumber: "50100234567890",
        ifscCode: "HDFC0001234",
      };
      const result = payoutAccountSchema.safeParse(validBank);
      expect(result.success).toBe(true);
    });

    it("rejects mismatched account numbers", () => {
      const mismatched = {
        accountType: "bank_account",
        beneficiaryName: "Maddy Organizer",
        bankName: "HDFC Bank",
        accountNumber: "50100234567890",
        confirmAccountNumber: "50100234567899",
        ifscCode: "HDFC0001234",
      };
      const result = payoutAccountSchema.safeParse(mismatched);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((e) => e.path.includes("confirmAccountNumber"))).toBe(true);
      }
    });

    it("rejects invalid IFSC formats", () => {
      const invalidIfsc = {
        accountType: "bank_account",
        beneficiaryName: "Maddy Organizer",
        bankName: "HDFC Bank",
        accountNumber: "50100234567890",
        confirmAccountNumber: "50100234567890",
        ifscCode: "HDFC1234", // too short
      };
      const result = payoutAccountSchema.safeParse(invalidIfsc);
      expect(result.success).toBe(false);
    });

    it("validates a valid UPI ID", () => {
      const validUpi = {
        accountType: "upi",
        beneficiaryName: "Maddy Organizer",
        upiId: "maddy@okhdfcbank",
      };
      const result = payoutAccountSchema.safeParse(validUpi);
      expect(result.success).toBe(true);
    });

    it("rejects invalid UPI IDs", () => {
      const invalidUpi = {
        accountType: "upi",
        beneficiaryName: "Maddy",
        upiId: "not-a-upi-id",
      };
      const result = payoutAccountSchema.safeParse(invalidUpi);
      expect(result.success).toBe(false);
    });
  });

  describe("requestPayoutSchema", () => {
    it("accepts valid payout request for an event", () => {
      const valid = {
        eventId: sampleUuid,
        amountRupees: 500, // ₹500
        notes: "Settlement for music night",
      };
      const result = requestPayoutSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects payout below minimum threshold or non-uuid event", () => {
      const tooLow = {
        eventId: sampleUuid,
        amountRupees: 0,
      };
      expect(requestPayoutSchema.safeParse(tooLow).success).toBe(false);

      const invalidUuid = {
        eventId: "not-a-uuid",
        amountRupees: 100,
      };
      expect(requestPayoutSchema.safeParse(invalidUuid).success).toBe(false);
    });
  });

  describe("processPayoutSchema", () => {
    it("approves payout with UTR number", () => {
      const approve = {
        payoutId: sampleUuid,
        action: "approve",
        utr: "CMS987654321",
        notes: "Disbursed via automated batch",
      };
      const result = processPayoutSchema.safeParse(approve);
      expect(result.success).toBe(true);
    });

    it("requires valid uuid for payoutId", () => {
      const invalid = {
        payoutId: "invalid-id",
        action: "approve",
      };
      const result = processPayoutSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("fee calculations", () => {
    it("computes 5% platform fee correctly", () => {
      const grossPaise = 100000; // ₹1,000.00
      const feePaise = Math.round(grossPaise * PLATFORM_FEE_RATE);
      const netPaise = grossPaise - feePaise;

      expect(PLATFORM_FEE_PERCENT).toBe(5);
      expect(feePaise).toBe(5000); // ₹50.00
      expect(netPaise).toBe(95000); // ₹950.00
    });
  });
});
