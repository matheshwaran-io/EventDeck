"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  processPayout,
  requestPayout,
  saveOrganizerPayoutAccount,
} from "@/lib/server/payouts";
import { toActionError, type ActionResult } from "@/lib/server/errors";
import {
  payoutAccountSchema,
  processPayoutSchema,
  requestPayoutSchema,
  type PayoutAccountInput,
  type ProcessPayoutInput,
  type RequestPayoutInput,
} from "@/lib/validation/payouts";

export async function savePayoutAccountAction(input: PayoutAccountInput): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const parsed = payoutAccountSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your payout details." };
    }
    await saveOrganizerPayoutAccount(user, parsed.data);
    revalidatePath("/organizer/payouts");
    return { ok: true, message: "Payout bank & UPI account saved and verified in Test Mode." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function requestPayoutAction(
  input: RequestPayoutInput,
): Promise<ActionResult<{ reference: string }>> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const parsed = requestPayoutSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payout amount." };
    }
    const payout = await requestPayout(user, parsed.data);
    revalidatePath("/organizer/payouts");
    revalidatePath("/admin/payouts");
    return {
      ok: true,
      message: `Payout request ${payout.reference} submitted. An administrator will disburse your funds.`,
      data: { reference: payout.reference },
    };
  } catch (err) {
    return toActionError(err);
  }
}

export async function processPayoutAction(input: ProcessPayoutInput): Promise<ActionResult> {
  try {
    const admin = await requireUser(["admin"]);
    const parsed = processPayoutSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payout parameters." };
    }
    const payout = await processPayout(admin, parsed.data);
    revalidatePath("/admin/payouts");
    revalidatePath("/organizer/payouts");
    return {
      ok: true,
      message:
        parsed.data.action === "approve"
          ? `Payout ${payout.reference} marked as completed & disbursed (UTR: ${payout.utr}).`
          : `Payout ${payout.reference} has been rejected.`,
    };
  } catch (err) {
    return toActionError(err);
  }
}
