import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { audit } from "@/lib/server/audit";
import { DomainError } from "@/lib/server/errors";
import { jsonError, readJson } from "@/lib/server/http";
import { confirmPayment } from "@/lib/server/payments";

const schema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(128),
});

/** Razorpay Checkout success handler. The client's claim is only trusted once the HMAC signature verifies. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new DomainError("Invalid payment response.");
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

    const [row] = await db
      .select({ userId: bookings.userId, bookingId: bookings.id, provider: payments.provider })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(payments.orderId, orderId))
      .limit(1);
    if (!row || row.userId !== user.id || row.provider !== "razorpay") throw new DomainError("Payment not found.", "not_found");

    if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
      await audit(db, {
        actorId: user.id,
        action: "payment.signature_invalid",
        entityType: "payment",
        entityId: orderId,
        details: { paymentId },
      });
      throw new DomainError("Payment verification failed. If you were charged, it will be reconciled automatically.", "forbidden");
    }

    const result = await confirmPayment({ orderId, paymentId, via: "checkout", actorId: user.id });
    return NextResponse.json({ ...result, bookingId: row.bookingId });
  } catch (err) {
    return jsonError(err);
  }
}
