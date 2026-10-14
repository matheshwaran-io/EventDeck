import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingItems, bookings, events, payments, refunds, webhookEvents, type Profile } from "@/db/schema";
import { createRazorpayOrder, paymentMode } from "@/lib/razorpay";
import { audit, notify, notifyAdmins } from "./audit";
import { expireHolds, issueTickets, reserveInventory, transitionBooking } from "./bookings";
import { DomainError } from "./errors";

export type CheckoutOrder = {
  provider: "razorpay" | "mock";
  keyId: string | null;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  bookingReference: string;
  eventTitle: string;
  expiresAt: string;
  prefill: { name: string; email: string };
};

/** Create (or reuse) a payment order for a held booking. Amount comes only from the booking row. */
export async function createOrderForBooking(user: Profile, bookingId: string): Promise<CheckoutOrder> {
  await expireHolds({ bookingId });
  const mode = paymentMode();
  if (mode === "disabled") {
    throw new DomainError("Online payments aren't configured. Please contact the organizer.", "unavailable");
  }

  const [row] = await db
    .select({ booking: bookings, eventTitle: events.title, eventStatus: events.status })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row || row.booking.userId !== user.id) throw new DomainError("Booking not found.", "not_found");
  const b = row.booking;
  if (row.eventStatus === "cancelled") throw new DomainError("This event has been cancelled.", "closed");
  if (b.status !== "awaiting_payment" || b.paymentStatus === "paid") {
    throw new DomainError("This booking isn't awaiting payment.", "conflict");
  }
  if (!b.expiresAt || b.expiresAt.getTime() - Date.now() < 20_000) {
    throw new DomainError("Your reservation is about to expire. Please start a new booking.", "closed");
  }

  const base = {
    keyId: mode === "razorpay" ? process.env.RAZORPAY_KEY_ID! : null,
    amountPaise: b.amountPaise,
    currency: "INR" as const,
    bookingReference: b.reference,
    eventTitle: row.eventTitle,
    expiresAt: b.expiresAt.toISOString(),
    prefill: { name: user.fullName, email: user.email },
  };

  // Reuse an open order for the same amount so retries don't create duplicate orders.
  const [open] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, b.id), eq(payments.status, "created"), eq(payments.provider, mode)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (open && open.amountPaise === b.amountPaise) {
    await markPending(b.id);
    return { ...base, provider: mode, orderId: open.orderId };
  }

  const orderId =
    mode === "razorpay"
      ? (await createRazorpayOrder({ amountPaise: b.amountPaise, receipt: b.reference, bookingId: b.id })).id
      : `order_mock_${randomBytes(9).toString("base64url")}`;

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({ bookingId: b.id, provider: mode, orderId, amountPaise: b.amountPaise });
    await audit(tx, {
      actorId: user.id,
      action: "payment.order_created",
      entityType: "payment",
      entityId: orderId,
      eventId: b.eventId,
      details: { reference: b.reference, amountPaise: b.amountPaise, provider: mode },
    });
  });
  await markPending(b.id);
  return { ...base, provider: mode, orderId };
}

async function markPending(bookingId: string) {
  // A retry after a failed attempt puts the booking back to "pending".
  await db
    .update(bookings)
    .set({ paymentStatus: "pending", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "awaiting_payment"), eq(bookings.paymentStatus, "failed")));
}

export type ConfirmOutcome =
  | "confirmed"
  | "already_processed"
  | "recovered_late"
  | "exception"
  | "refund_queued"
  | "duplicate"
  | "unknown_order";

/**
 * Apply a verified successful payment. Called from the checkout callback, the
 * webhook, and the local simulator. Idempotent and safe under concurrency:
 * the payment row and booking row are both locked for the duration.
 */
export async function confirmPayment(input: {
  orderId: string;
  paymentId: string;
  via: "checkout" | "webhook" | "mock";
  actorId?: string | null;
}): Promise<{ outcome: ConfirmOutcome; bookingId?: string }> {
  return db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.orderId, input.orderId)).for("update");
    if (!pay) return { outcome: "unknown_order" as const };

    if (pay.status === "paid") {
      if (pay.paymentId === input.paymentId) return { outcome: "already_processed" as const, bookingId: pay.bookingId };
      // A second, different payment against the same order.
      await audit(tx, {
        actorId: input.actorId ?? null,
        action: "payment.duplicate_detected",
        entityType: "payment",
        entityId: input.orderId,
        details: { firstPaymentId: pay.paymentId, duplicatePaymentId: input.paymentId, via: input.via },
      });
      await notifyAdmins(tx, {
        type: "payment.exception",
        title: "Duplicate payment detected",
        body: `Order ${input.orderId} received a second payment (${input.paymentId}).`,
        href: "/admin/exceptions",
      });
      return { outcome: "duplicate" as const, bookingId: pay.bookingId };
    }

    const [b] = await tx.select().from(bookings).where(eq(bookings.id, pay.bookingId)).for("update");
    if (!b) throw new Error("Payment references a missing booking");
    const [event] = await tx.select().from(events).where(eq(events.id, b.eventId));
    if (!event) throw new Error("Booking references a missing event");

    let flag: string | null = null;
    let outcome: ConfirmOutcome = "confirmed";
    const href = `/my/bookings/${b.id}`;

    const markPaid = async () => {
      await tx
        .update(payments)
        .set({
          status: "paid",
          paymentId: input.paymentId,
          signatureVerified: true,
          confirmedVia: input.via,
          paidAt: new Date(),
          updatedAt: new Date(),
          flag,
          failureReason: null,
        })
        .where(eq(payments.id, pay.id));
    };

    if (b.status === "awaiting_payment") {
      const row = await transitionBooking(tx, b.id, "awaiting_payment", "approved", {
        paymentStatus: "paid",
        expiresAt: null,
        decidedAt: new Date(),
      });
      await markPaid();
      const issued = await issueTickets(tx, row ?? b, event.title);
      await audit(tx, {
        actorId: b.userId,
        action: "booking.approved",
        entityType: "booking",
        entityId: b.id,
        eventId: b.eventId,
        details: { reference: b.reference, kind: b.kind, ticketsIssued: issued, autoApproved: true },
      });
      await notify(tx, [
        {
          userId: b.userId,
          type: "booking.approved",
          title: "Payment confirmed — tickets ready",
          body: `${event.title}: payment for ${b.reference} succeeded. Your tickets are ready!`,
          href,
        },
        {
          userId: event.organizerId,
          type: "booking.created",
          title: "New ticket booking",
          body: `${b.reference} · ${b.quantity} ticket(s) · ${event.title}`,
          href: `/organizer/events/${event.id}/bookings`,
        },
      ]);
    } else if (b.status === "expired" || b.status === "cancelled") {
      // Late payment: try to re-allocate the same seats inside a savepoint.
      let recovered = false;
      if (event.status === "published" && event.endAt > new Date()) {
        try {
          await tx.transaction(async (sp) => {
            const items = await sp
              .select({ tierId: bookingItems.tierId, quantity: bookingItems.quantity })
              .from(bookingItems)
              .where(eq(bookingItems.bookingId, b.id));
            await reserveInventory(sp, b.eventId, items);
          });
          recovered = true;
        } catch {
          recovered = false;
        }
      }
      if (recovered) {
        flag = "late_payment_recovered";
        outcome = "recovered_late";
        const row = await transitionBooking(tx, b.id, b.status, "approved", {
          paymentStatus: "paid",
          expiresAt: null,
          cancelledAt: null,
          decidedAt: new Date(),
        });
        await markPaid();
        const issued = await issueTickets(tx, row ?? b, event.title);
        await audit(tx, {
          actorId: b.userId,
          action: "booking.approved",
          entityType: "booking",
          entityId: b.id,
          eventId: b.eventId,
          details: { reference: b.reference, kind: b.kind, ticketsIssued: issued, autoApproved: true },
        });
        await notify(tx, [
          {
            userId: b.userId,
            type: "booking.approved",
            title: "Payment confirmed — tickets ready",
            body: `Your payment for ${b.reference} arrived after the reservation lapsed, but seats were still available — your tickets are confirmed!`,
            href,
          },
          {
            userId: event.organizerId,
            type: "booking.created",
            title: "Late payment recovered",
            body: `${b.reference} · ${b.quantity} ticket(s) · ${event.title}`,
            href: `/organizer/events/${event.id}/bookings`,
          },
        ]);
      } else {
        flag = "late_payment_unallocated";
        outcome = "exception";
        await transitionBooking(tx, b.id, b.status, "payment_exception", {
          paymentStatus: "paid",
          expiresAt: null,
          exceptionReason: "Payment succeeded after the reservation lapsed and seats could not be re-allocated.",
        });
        await markPaid();
        await notify(tx, {
          userId: b.userId,
          type: "payment.exception",
          title: "Payment received — needs review",
          body: `Your payment for ${b.reference} arrived after your reservation lapsed and no tickets were issued. An administrator will follow up.`,
          href,
        });
        await notifyAdmins(tx, {
          type: "payment.exception",
          title: "Late payment could not be allocated",
          body: `${b.reference} (${event.title}) — payment ${input.paymentId} needs handling.`,
          href: "/admin/exceptions",
        });
      }
    } else if (b.status === "event_cancelled") {
      flag = "paid_after_event_cancellation";
      outcome = "refund_queued";
      await markPaid();
      await tx
        .update(bookings)
        .set({ paymentStatus: "paid", refundStatus: "pending", updatedAt: new Date() })
        .where(eq(bookings.id, b.id));
      await tx
        .insert(refunds)
        .values({
          bookingId: b.id,
          paymentId: pay.id,
          eventId: b.eventId,
          amountPaise: pay.amountPaise,
          reason: "Event cancelled",
        })
        .onConflictDoNothing({ target: refunds.bookingId });
      await notify(tx, {
        userId: b.userId,
        type: "refund.pending",
        title: "Refund queued",
        body: `${event.title} was cancelled. A refund for ${b.reference} has been queued.`,
        href,
      });
    } else {
      // Booking already paid via another order, or otherwise closed.
      flag = "duplicate_payment";
      outcome = "duplicate";
      await markPaid();
      await notifyAdmins(tx, {
        type: "payment.exception",
        title: "Unexpected payment",
        body: `${b.reference} received an additional payment (${input.paymentId}) while ${b.status.replace(/_/g, " ")}.`,
        href: "/admin/exceptions",
      });
    }

    await audit(tx, {
      actorId: input.actorId ?? null,
      action: "payment.captured",
      entityType: "payment",
      entityId: input.orderId,
      eventId: b.eventId,
      details: { reference: b.reference, paymentId: input.paymentId, via: input.via, outcome, flag },
    });
    return { outcome, bookingId: b.id };
  });
}

export async function markPaymentFailed(input: { orderId: string; reason: string; via: string; userId?: string }) {
  return db.transaction(async (tx) => {
    const [pay] = await tx.select().from(payments).where(eq(payments.orderId, input.orderId)).for("update");
    if (!pay || pay.status !== "created") return false;
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, pay.bookingId)).for("update");
    if (!b) return false;
    if (input.userId && b.userId !== input.userId) throw new DomainError("Booking not found.", "not_found");

    await tx
      .update(payments)
      .set({ status: "failed", failureReason: input.reason.slice(0, 300), updatedAt: new Date() })
      .where(eq(payments.id, pay.id));
    if (b.status === "awaiting_payment" && b.paymentStatus === "pending") {
      await tx.update(bookings).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(bookings.id, b.id));
      await notify(tx, {
        userId: b.userId,
        type: "payment.failed",
        title: "Payment didn't go through",
        body: `You can retry payment for ${b.reference} until your reservation expires.`,
        href: `/my/bookings/${b.id}`,
      });
    }
    await audit(tx, {
      actorId: input.userId ?? null,
      action: "payment.failed",
      entityType: "payment",
      entityId: input.orderId,
      eventId: b.eventId,
      details: { reference: b.reference, reason: input.reason.slice(0, 120), via: input.via },
    });
    return true;
  });
}

export async function webhookAlreadyProcessed(eventId: string) {
  const [row] = await db.select({ id: webhookEvents.id }).from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).limit(1);
  return Boolean(row);
}

/** Record a processed webhook delivery. Processing itself is idempotent, so this only short-circuits retries. */
export async function recordWebhookEvent(eventId: string, eventType: string, outcome: string) {
  await db
    .insert(webhookEvents)
    .values({ provider: "razorpay", eventId, eventType, outcome })
    .onConflictDoNothing({ target: webhookEvents.eventId });
}
