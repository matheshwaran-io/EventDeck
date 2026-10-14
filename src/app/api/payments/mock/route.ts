import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { paymentMode } from "@/lib/razorpay";
import { DomainError } from "@/lib/server/errors";
import { jsonError, readJson } from "@/lib/server/http";
import { confirmPayment, markPaymentFailed } from "@/lib/server/payments";

const schema = z.object({ orderId: z.string().startsWith("order_mock_").max(64), outcome: z.enum(["success", "failure"]) });

/**
 * Local payment simulator — only active when Razorpay keys are absent,
 * ALLOW_MOCK_PAYMENTS=true, and not a Vercel production deployment.
 * It drives the same confirmation code path as a verified Razorpay payment.
 */
export async function POST(request: Request) {
  try {
    if (paymentMode() !== "mock") throw new DomainError("The payment simulator is disabled.", "forbidden");
    const user = await requireUser();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DomainError("Invalid request.");
    const [row] = await db
      .select({ userId: bookings.userId, bookingId: bookings.id })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(payments.orderId, parsed.data.orderId))
      .limit(1);
    if (!row || row.userId !== user.id) throw new DomainError("Payment not found.", "not_found");

    if (parsed.data.outcome === "failure") {
      await markPaymentFailed({ orderId: parsed.data.orderId, reason: "Simulated decline", via: "mock", userId: user.id });
      return NextResponse.json({ outcome: "failed", bookingId: row.bookingId });
    }
    const result = await confirmPayment({
      orderId: parsed.data.orderId,
      paymentId: `pay_mock_${randomBytes(9).toString("base64url")}`,
      via: "mock",
      actorId: user.id,
    });
    return NextResponse.json({ ...result, bookingId: row.bookingId });
  } catch (err) {
    return jsonError(err);
  }
}
