import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { bookings, webhookEvents } from "@/db/schema";
import { createBooking } from "@/lib/server/bookings";
import { createOrderForBooking } from "@/lib/server/payments";
import { POST } from "@/app/api/webhooks/razorpay/route";
import { cleanup, key, makeEvent, makeUser } from "./helpers";

const SECRET = "whsec_test_fixture";

beforeAll(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  process.env.ALLOW_MOCK_PAYMENTS = "true";
  delete process.env.RAZORPAY_KEY_ID;
});
afterAll(cleanup);

function webhook(body: object, eventId: string, signature?: string) {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": eventId,
      "x-razorpay-signature": signature ?? createHmac("sha256", SECRET).update(raw).digest("hex"),
    },
    body: raw,
  });
}

describe("Razorpay webhook route", () => {
  it("rejects bad signatures, applies payment.captured once, and dedupes retries", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(u, b.id);
    const payload = { event: "payment.captured", payload: { payment: { entity: { id: `pay_${randomUUID().slice(0, 10)}`, order_id: order.orderId, status: "captured" } } } };
    const evtId = `evt_${randomUUID()}`;

    const forged = await POST(webhook(payload, evtId, "deadbeef"));
    expect(forged.status).toBe(401);
    expect((await db.select().from(bookings).where(eq(bookings.id, b.id)))[0]!.paymentStatus).toBe("pending");

    const first = await POST(webhook(payload, evtId));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ outcome: "confirmed" });

    const retry = await POST(webhook(payload, evtId));
    expect(await retry.json()).toMatchObject({ duplicate: true });

    // Same payment delivered under a different event id is still idempotent.
    const other = await POST(webhook({ ...payload, event: "order.paid" }, `evt_${randomUUID()}`));
    expect(await other.json()).toMatchObject({ outcome: "already_processed" });

    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after).toMatchObject({ status: "approved", paymentStatus: "paid" });
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, evtId));
  });
});
