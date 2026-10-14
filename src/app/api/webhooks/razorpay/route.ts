import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { applyRefundWebhook } from "@/lib/server/cancellations";
import { confirmPayment, markPaymentFailed, recordWebhookEvent, webhookAlreadyProcessed } from "@/lib/server/payments";

type RazorpayWebhook = {
  event: string;
  payload?: {
    payment?: { entity?: { id: string; order_id: string; status: string; error_description?: string } };
    refund?: { entity?: { id: string; status: string } };
  };
};

/**
 * Razorpay webhook (Test Mode). Signature is verified against the raw body;
 * deliveries are deduplicated by x-razorpay-event-id, and every handler is
 * itself idempotent so retries are always safe.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhook;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = request.headers.get("x-razorpay-event-id") ?? `${body.event}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? "unknown"}`;
  if (await webhookAlreadyProcessed(eventId)) return NextResponse.json({ ok: true, duplicate: true });

  let outcome = "ignored";
  try {
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    switch (body.event) {
      case "payment.captured":
      case "order.paid":
        if (payment?.order_id) outcome = (await confirmPayment({ orderId: payment.order_id, paymentId: payment.id, via: "webhook" })).outcome;
        break;
      case "payment.failed":
        if (payment?.order_id)
          outcome = (await markPaymentFailed({ orderId: payment.order_id, reason: payment.error_description ?? "Payment failed", via: "webhook" }))
            ? "marked_failed"
            : "noop";
        break;
      case "refund.processed":
        if (refund?.id) outcome = (await applyRefundWebhook(refund.id, "processed")) ? "refund_processed" : "noop";
        break;
      case "refund.failed":
        if (refund?.id) outcome = (await applyRefundWebhook(refund.id, "failed", "Reported failed by Razorpay")) ? "refund_failed" : "noop";
        break;
    }
  } catch (err) {
    console.error("[webhook] processing failed", body.event, err instanceof Error ? err.message : err);
    // 500 makes Razorpay retry; processing is idempotent.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await recordWebhookEvent(eventId, body.event, outcome);
  return NextResponse.json({ ok: true, outcome });
}
