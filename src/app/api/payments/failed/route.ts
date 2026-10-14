import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/server/errors";
import { jsonError, readJson } from "@/lib/server/http";
import { markPaymentFailed } from "@/lib/server/payments";

const schema = z.object({ orderId: z.string().min(5).max(64), reason: z.string().max(300).default("Payment was not completed") });

/** Client-reported failure/dismissal. Only moves an unpaid attempt to failed; never touches paid state. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DomainError("Invalid request.");
    await markPaymentFailed({ orderId: parsed.data.orderId, reason: parsed.data.reason, via: "checkout", userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
