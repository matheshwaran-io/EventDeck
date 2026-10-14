import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { bookings, notifications, payments, refunds, tickets, webhookEvents } from "@/db/schema";
import {
  cancelOwnBooking,
  createBooking,
  decideBooking,
  expireHolds,
} from "@/lib/server/bookings";
import { approveCancellation, processRefund, requestCancellation } from "@/lib/server/cancellations";
import { checkInTicket } from "@/lib/server/checkin";
import { DomainError } from "@/lib/server/errors";
import { confirmPayment, createOrderForBooking, markPaymentFailed, recordWebhookEvent, webhookAlreadyProcessed } from "@/lib/server/payments";
import { qrPayload } from "@/lib/domain/tokens";
import { booking, cleanup, key, makeEvent, makeUser, tier } from "./helpers";

process.env.ALLOW_MOCK_PAYMENTS = "true";
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;

afterAll(cleanup);

async function forceExpire(bookingId: string) {
  await db.update(bookings).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, bookingId));
}

describe("inventory concurrency", () => {
  it("never oversells under concurrent booking attempts", async () => {
    const org = await makeUser("organizer");
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "GA", pricePaise: 10000, capacity: 5 }], maxPerBooking: 1 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => makeUser()));

    const results = await Promise.allSettled(
      buyers.map((u) =>
        createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const soldOut = results.filter((r) => r.status === "rejected" && (r.reason as DomainError).code === "sold_out");
    expect(ok).toHaveLength(5);
    expect(soldOut).toHaveLength(15);
    expect((await tier(tiers[0]!.id)).allocated).toBe(5);
  });

  it("is idempotent for repeated submissions with the same key", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const k = key();
    const input = { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 2 }], attendeeNames: [], idempotencyKey: k };
    const [a, b] = await Promise.all([createBooking(u, input), createBooking(u, input)]);
    expect(a.id).toBe(b.id);
    expect((await tier(tiers[0]!.id)).allocated).toBe(2);
  });

  it("enforces per-booking limits, deadlines and eligibility on the server", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser("participant", "guest");
    const { event, tiers } = await makeEvent(org, { maxPerBooking: 2 });
    await expect(
      createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 3 }], attendeeNames: [], idempotencyKey: key() }),
    ).rejects.toThrow(/up to 2/);

    const closed = await makeEvent(org, { registrationClosesAt: new Date(Date.now() - 60_000) });
    await expect(
      createBooking(u, { eventId: closed.event.id, lines: [{ tierId: closed.tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() }),
    ).rejects.toThrow(/closed/);

    const studentsOnly = await makeEvent(org, { eligible: ["host_student"] });
    await expect(
      createBooking(u, { eventId: studentsOnly.event.id, lines: [{ tierId: studentsOnly.tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() }),
    ).rejects.toThrow(/eligible/);
  });

  it("ignores client prices: amount is computed from the database", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "VIP", pricePaise: 99900, capacity: 3 }] });
    const b = await createBooking(u, {
      eventId: event.id,
      lines: [{ tierId: tiers[0]!.id, quantity: 2 }],
      attendeeNames: ["A", "B"],
      idempotencyKey: key(),
    });
    expect(b.amountPaise).toBe(199800);
    expect(b.status).toBe("awaiting_payment");
    expect(b.expiresAt!.getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
  });
});

describe("holds, expiry and cancellation", () => {
  it("expires stale holds once and releases inventory exactly once", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 3 }], attendeeNames: [], idempotencyKey: key() });
    expect((await tier(tiers[0]!.id)).allocated).toBe(3);
    await forceExpire(b.id);
    const counts = await Promise.all([expireHolds({ eventId: event.id }), expireHolds({ eventId: event.id }), expireHolds({ bookingId: b.id })]);
    expect(counts.reduce((a, c) => a + c, 0)).toBe(1);
    expect((await booking(b.id)).status).toBe("expired");
    expect((await tier(tiers[0]!.id)).allocated).toBe(0);
  });

  it("lets a participant cancel an unpaid hold but not someone else's", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const other = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 2 }], attendeeNames: [], idempotencyKey: key() });
    await expect(cancelOwnBooking(other, b.id)).rejects.toThrow(/not found/);
    await cancelOwnBooking(u, b.id);
    await expect(cancelOwnBooking(u, b.id)).rejects.toThrow();
    expect((await booking(b.id)).status).toBe("cancelled");
    expect((await tier(tiers[0]!.id)).allocated).toBe(0);
  });
});

describe("payments", () => {
  it("confirms a payment once, even when checkout and webhook race", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(u, b.id);
    const again = await createOrderForBooking(u, b.id);
    expect(again.orderId).toBe(order.orderId); // open order reused
    expect(order.amountPaise).toBe(50000);

    const results = await Promise.all([
      confirmPayment({ orderId: order.orderId, paymentId: "pay_test_1", via: "checkout" }),
      confirmPayment({ orderId: order.orderId, paymentId: "pay_test_1", via: "webhook" }),
      confirmPayment({ orderId: order.orderId, paymentId: "pay_test_1", via: "webhook" }),
    ]);
    expect(results.filter((r) => r.outcome === "confirmed")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already_processed")).toHaveLength(2);
    const after = await booking(b.id);
    expect(after.status).toBe("approved");
    expect(after.paymentStatus).toBe("paid");
    // Normal paid bookings are auto-approved and tickets issued immediately.
    expect(await db.select().from(tickets).where(eq(tickets.bookingId, b.id))).toHaveLength(1);
  });

  it("records failures and allows retry within the hold", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const o1 = await createOrderForBooking(u, b.id);
    expect(await markPaymentFailed({ orderId: o1.orderId, reason: "card declined", via: "checkout", userId: u.id })).toBe(true);
    expect((await booking(b.id)).paymentStatus).toBe("failed");
    const o2 = await createOrderForBooking(u, b.id);
    expect(o2.orderId).not.toBe(o1.orderId);
    expect((await booking(b.id)).paymentStatus).toBe("pending");
    await confirmPayment({ orderId: o2.orderId, paymentId: `pay_retry_${key().slice(0, 8)}`, via: "mock" });
    expect((await booking(b.id)).status).toBe("approved");
  });

  it("recovers a late payment when seats are still free", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "GA", pricePaise: 20000, capacity: 2 }] });
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(u, b.id);
    await forceExpire(b.id);
    await expireHolds({ bookingId: b.id });
    expect((await tier(tiers[0]!.id)).allocated).toBe(0);
    const r = await confirmPayment({ orderId: order.orderId, paymentId: `pay_late_ok_${key().slice(0, 8)}`, via: "webhook" });
    expect(r.outcome).toBe("recovered_late");
    expect((await booking(b.id)).status).toBe("approved");
    expect((await tier(tiers[0]!.id)).allocated).toBe(1);
  });

  it("parks a late payment as an exception when seats are gone — never issuing a ticket", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const rival = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "GA", pricePaise: 20000, capacity: 1 }] });
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(u, b.id);
    await cancelOwnBooking(u, b.id);
    await createBooking(rival, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const r = await confirmPayment({ orderId: order.orderId, paymentId: `pay_late_bad_${key().slice(0, 8)}`, via: "webhook" });
    expect(r.outcome).toBe("exception");
    const after = await booking(b.id);
    expect(after.status).toBe("payment_exception");
    expect(after.paymentStatus).toBe("paid");
    expect(after.exceptionReason).toBeTruthy();
    expect((await tier(tiers[0]!.id)).allocated).toBe(1);
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, order.orderId));
    expect(pay!.status).toBe("paid"); // the successful payment is preserved, not discarded
  });

  it("deduplicates webhook deliveries by event id", async () => {
    const id = `evt_${key()}`;
    expect(await webhookAlreadyProcessed(id)).toBe(false);
    await recordWebhookEvent(id, "payment.captured", "confirmed");
    await recordWebhookEvent(id, "payment.captured", "confirmed");
    expect(await webhookAlreadyProcessed(id)).toBe(true);
    await db.delete(webhookEvents).where(eq(webhookEvents.eventId, id));
  });
});

describe("verification, tickets and check-in", () => {
  it("issues tickets for complimentary passes only on organizer approval", async () => {
    const org = await makeUser("organizer");
    const otherOrg = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "VIP", pricePaise: 50000, capacity: 10 }] });
    const b = await createBooking(u, {
      eventId: event.id,
      lines: [{ tierId: tiers[0]!.id, quantity: 2 }],
      attendeeNames: ["Asha", "Ravi"],
      complimentary: { reason: "VIP Guest pass" },
      idempotencyKey: key(),
    });
    expect(b.kind).toBe("complimentary");
    expect(b.status).toBe("pending_verification");
    await expect(decideBooking(otherOrg, b.id, "approve")).rejects.toThrow(/own events/);
    await expect(decideBooking(u, b.id, "approve")).rejects.toThrow();

    const results = await Promise.allSettled([decideBooking(org, b.id, "approve"), decideBooking(org, b.id, "approve")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const issued = await db.select().from(tickets).where(eq(tickets.bookingId, b.id));
    expect(issued).toHaveLength(2);
    expect(issued.map((t) => t.attendeeName).sort()).toEqual(["Asha", "Ravi"]);
    expect(new Set(issued.map((t) => t.qrToken)).size).toBe(2);
  });

  it("rejecting a pass request releases seats", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "VIP", pricePaise: 50000, capacity: 10 }] });
    const b = await createBooking(u, {
      eventId: event.id,
      lines: [{ tierId: tiers[0]!.id, quantity: 2 }],
      attendeeNames: [],
      complimentary: { reason: "Not eligible" },
      idempotencyKey: key(),
    });
    expect(b.status).toBe("pending_verification");
    await decideBooking(org, b.id, "reject", "Not eligible");
    const after = await booking(b.id);
    expect(after.status).toBe("rejected");
    expect((await tier(tiers[0]!.id)).allocated).toBe(0);
  });

  it("complimentary passes cost zero and need approval", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { allowPassRequests: true });
    const b = await createBooking(u, {
      eventId: event.id,
      lines: [{ tierId: tiers[0]!.id, quantity: 1 }],
      attendeeNames: [],
      idempotencyKey: key(),
      complimentary: { reason: "Volunteer coordinator for the event" },
    });
    expect(b.kind).toBe("complimentary");
    expect(b.amountPaise).toBe(0);
    expect(b.paymentStatus).toBe("not_required");
    await decideBooking(org, b.id, "approve");
    expect((await booking(b.id)).status).toBe("approved");
  });

  it("checks in a valid ticket once, refusing duplicates, other events and closed windows", async () => {
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "Free", pricePaise: 0, capacity: 5 }] });
    const other = await makeEvent(org, { tiers: [{ name: "Free", pricePaise: 0, capacity: 5 }] });
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    await decideBooking(org, b.id, "approve");
    const [t] = await db.select().from(tickets).where(eq(tickets.bookingId, b.id));

    const wrong = await checkInTicket(org, other.event.id, qrPayload(t!.qrToken), "qr");
    expect(wrong.status).toBe("invalid");

    const scans = await Promise.all([
      checkInTicket(org, event.id, qrPayload(t!.qrToken), "qr"),
      checkInTicket(org, event.id, qrPayload(t!.qrToken), "qr"),
      checkInTicket(org, event.id, t!.ticketNumber, "manual"),
    ]);
    expect(scans.filter((s) => s.status === "checked_in")).toHaveLength(1);
    expect(scans.filter((s) => s.status === "already_used")).toHaveLength(2);

    expect((await checkInTicket(org, event.id, "EVD1:not-a-real-token-at-all-xxxxxxxx", "qr")).status).toBe("invalid");

    const later = await makeEvent(org, {
      tiers: [{ name: "Free", pricePaise: 0, capacity: 5 }],
      checkinOpensAt: new Date(Date.now() + 86400_000),
      checkinClosesAt: new Date(Date.now() + 2 * 86400_000),
    });
    const b2 = await createBooking(u, { eventId: later.event.id, lines: [{ tierId: later.tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    await decideBooking(org, b2.id, "approve");
    const [t2] = await db.select().from(tickets).where(eq(tickets.bookingId, b2.id));
    expect((await checkInTicket(org, later.event.id, qrPayload(t2!.qrToken), "qr")).status).toBe("outside_window");
  });
});

describe("event cancellation and refunds", () => {
  it("cancels via admin approval, invalidates tickets, queues and processes refunds", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser("organizer");
    const paidUser = await makeUser();
    const holdUser = await makeUser();
    const { event, tiers } = await makeEvent(org, { tiers: [{ name: "GA", pricePaise: 30000, capacity: 10 }] });

    const paid = await createBooking(paidUser, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 2 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(paidUser, paid.id);
    await confirmPayment({ orderId: order.orderId, paymentId: `pay_${key().slice(0, 8)}`, via: "mock" });
    await decideBooking(org, paid.id, "approve");
    const hold = await createBooking(holdUser, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });

    const req = await requestCancellation(org, event.id, "Speaker unavailable due to travel disruption");
    await expect(requestCancellation(org, event.id, "Second request should be blocked")).rejects.toThrow(/already pending/);
    const res = await approveCancellation(admin, { requestId: req.id });
    expect(res).toEqual({ affected: 2, refunds: 1 });

    expect((await booking(paid.id)).status).toBe("event_cancelled");
    expect((await booking(paid.id)).refundStatus).toBe("pending");
    expect((await booking(hold.id)).status).toBe("event_cancelled");
    const ts = await db.select().from(tickets).where(eq(tickets.bookingId, paid.id));
    expect(ts.every((t) => t.status === "invalidated")).toBe(true);
    expect((await tier(tiers[0]!.id)).allocated).toBe(0);

    await expect(
      createBooking(paidUser, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() }),
    ).rejects.toThrow(/cancelled/);

    const [refund] = await db.select().from(refunds).where(eq(refunds.bookingId, paid.id));
    expect(refund!.amountPaise).toBe(60000);
    const processed = await processRefund(admin, refund!.id);
    expect(processed.status).toBe("processed");
    expect((await booking(paid.id)).refundStatus).toBe("processed");
    expect((await processRefund(admin, refund!.id)).status).toBe("processed"); // idempotent

    const [note] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, paidUser.id), eq(notifications.type, "event.cancelled")));
    expect(note).toBeTruthy();
  });

  it("queues a refund when payment lands after the event was cancelled", async () => {
    const admin = await makeUser("admin");
    const org = await makeUser("organizer");
    const u = await makeUser();
    const { event, tiers } = await makeEvent(org);
    const b = await createBooking(u, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    const order = await createOrderForBooking(u, b.id);
    await approveCancellation(admin, { eventId: event.id, reason: "Venue flooded" });
    const r = await confirmPayment({ orderId: order.orderId, paymentId: `pay_${key().slice(0, 8)}`, via: "webhook" });
    expect(r.outcome).toBe("refund_queued");
    const [refund] = await db.select().from(refunds).where(eq(refunds.bookingId, b.id));
    expect(refund!.status).toBe("pending");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.bookingId, b.id));
    expect(n).toBe(0);
  });
});
