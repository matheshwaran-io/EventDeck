import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, cancellationRequests, events, payments, refunds, tickets, type Profile } from "@/db/schema";
import { createRazorpayRefund, paymentMode } from "@/lib/razorpay";
import { audit, notify, notifyAdmins } from "./audit";
import { assertCanManageEvent, releaseInventory, transitionBooking } from "./bookings";
import { DomainError, pgErrorCode } from "./errors";

export async function requestCancellation(actor: Profile, eventId: string, reason: string) {
  try {
    return await db.transaction(async (tx) => {
      const event = await assertCanManageEvent(tx, actor, eventId);
      if (event.status === "cancelled") throw new DomainError("This event is already cancelled.", "closed");
      const [req] = await tx
        .insert(cancellationRequests)
        .values({ eventId, requestedBy: actor.id, reason: reason.trim().slice(0, 1000) })
        .returning();
      await audit(tx, {
        actorId: actor.id,
        action: "event.cancellation_requested",
        entityType: "cancellation_request",
        entityId: req!.id,
        eventId,
        details: { reason: req!.reason.slice(0, 200) },
      });
      await notifyAdmins(tx, {
        type: "cancellation.requested",
        title: "Cancellation request",
        body: `${event.title}: ${req!.reason.slice(0, 140)}`,
        href: "/admin/cancellations",
      });
      return req!;
    });
  } catch (err) {
    if (pgErrorCode(err).constraint === "cancellation_requests_one_pending") {
      throw new DomainError("A cancellation request for this event is already pending.", "conflict");
    }
    throw err;
  }
}

export async function rejectCancellation(admin: Profile, requestId: string, note: string) {
  return db.transaction(async (tx) => {
    const [req] = await tx
      .update(cancellationRequests)
      .set({ status: "rejected", reviewedBy: admin.id, reviewedAt: new Date(), reviewNote: note.trim().slice(0, 500) || null })
      .where(and(eq(cancellationRequests.id, requestId), eq(cancellationRequests.status, "pending")))
      .returning();
    if (!req) throw new DomainError("This request was already reviewed.", "conflict");
    const [event] = await tx.select().from(events).where(eq(events.id, req.eventId));
    await audit(tx, {
      actorId: admin.id,
      action: "event.cancellation_rejected",
      entityType: "cancellation_request",
      entityId: req.id,
      eventId: req.eventId,
      details: { note: req.reviewNote },
    });
    await notify(tx, {
      userId: req.requestedBy,
      type: "cancellation.rejected",
      title: "Cancellation request declined",
      body: `${event?.title ?? "Event"}${req.reviewNote ? `: ${req.reviewNote}` : ""}`,
      href: `/organizer/events/${req.eventId}`,
    });
    return req;
  });
}

/**
 * Execute an approved cancellation: stop bookings, cancel the event,
 * invalidate tickets, queue refunds for paid bookings, notify everyone.
 * When `requestId` is omitted the admin is cancelling directly; a request
 * record is still written so the trail is uniform.
 */
export async function approveCancellation(admin: Profile, input: { requestId?: string; eventId?: string; reason?: string; note?: string }) {
  return db.transaction(async (tx) => {
    let req;
    if (input.requestId) {
      [req] = await tx.select().from(cancellationRequests).where(eq(cancellationRequests.id, input.requestId)).for("update");
      if (!req || req.status !== "pending") throw new DomainError("This request was already reviewed.", "conflict");
    } else {
      if (!input.eventId || !input.reason?.trim()) throw new DomainError("A reason is required.");
      await tx
        .update(cancellationRequests)
        .set({ status: "rejected", reviewedBy: admin.id, reviewedAt: new Date(), reviewNote: "Superseded by direct admin cancellation" })
        .where(and(eq(cancellationRequests.eventId, input.eventId), eq(cancellationRequests.status, "pending")));
      [req] = await tx
        .insert(cancellationRequests)
        .values({ eventId: input.eventId, requestedBy: admin.id, reason: input.reason.trim().slice(0, 1000) })
        .returning();
    }

    const [event] = await tx.select().from(events).where(eq(events.id, req!.eventId)).for("update");
    if (!event) throw new DomainError("Event not found.", "not_found");
    if (event.status === "cancelled") throw new DomainError("This event is already cancelled.", "closed");

    const now = new Date();
    await tx
      .update(cancellationRequests)
      .set({ status: "approved", reviewedBy: admin.id, reviewedAt: now, reviewNote: input.note?.trim().slice(0, 500) || null })
      .where(eq(cancellationRequests.id, req!.id));
    await tx
      .update(events)
      .set({ status: "cancelled", cancelledAt: now, cancellationReason: req!.reason, updatedAt: now })
      .where(eq(events.id, event.id));

    const affected = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.eventId, event.id), inArray(bookings.status, ["awaiting_payment", "pending_verification", "approved"])))
      .for("update");

    let refundCount = 0;
    for (const b of affected) {
      const paid = b.paymentStatus === "paid";
      await transitionBooking(tx, b.id, b.status, "event_cancelled", {
        expiresAt: null,
        paymentStatus: b.status === "awaiting_payment" ? "expired" : b.paymentStatus,
        refundStatus: paid ? "pending" : "not_applicable",
      });
      await releaseInventory(tx, b.id);
      await tx
        .update(tickets)
        .set({ status: "invalidated", invalidatedAt: now, invalidationReason: "Event cancelled" })
        .where(and(eq(tickets.bookingId, b.id), eq(tickets.status, "valid")));

      if (paid) {
        const [pay] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.bookingId, b.id), eq(payments.status, "paid")))
          .orderBy(desc(payments.paidAt))
          .limit(1);
        if (pay) {
          await tx
            .insert(refunds)
            .values({ bookingId: b.id, paymentId: pay.id, eventId: event.id, amountPaise: pay.amountPaise, reason: "Event cancelled" })
            .onConflictDoNothing({ target: refunds.bookingId });
          refundCount++;
        }
      }
      await notify(tx, {
        userId: b.userId,
        type: "event.cancelled",
        title: `${event.title} has been cancelled`,
        body: paid
          ? `Your tickets for ${b.reference} are no longer valid. A refund has been queued — track it on your booking.`
          : `Your booking ${b.reference} is no longer valid.`,
        href: `/my/bookings/${b.id}`,
      });
    }

    await audit(tx, {
      actorId: admin.id,
      action: "event.cancelled",
      entityType: "event",
      entityId: event.id,
      eventId: event.id,
      details: { reason: req!.reason.slice(0, 200), bookingsAffected: affected.length, refundsQueued: refundCount },
    });
    if (req!.requestedBy !== admin.id) {
      await notify(tx, {
        userId: req!.requestedBy,
        type: "cancellation.approved",
        title: "Cancellation approved",
        body: `${event.title} is now cancelled. ${affected.length} booking(s) affected, ${refundCount} refund(s) queued.`,
        href: `/organizer/events/${event.id}`,
      });
    } else if (event.organizerId !== admin.id) {
      await notify(tx, {
        userId: event.organizerId,
        type: "event.cancelled",
        title: "Your event was cancelled by an administrator",
        body: `${event.title}: ${req!.reason.slice(0, 140)}`,
        href: `/organizer/events/${event.id}`,
      });
    }
    return { affected: affected.length, refunds: refundCount };
  });
}

/* ----------------------------------------------------------------------------
 * Refund processing (Test Mode only)
 * ------------------------------------------------------------------------- */

export async function processRefund(admin: Profile, refundId: string) {
  return db.transaction(async (tx) => {
    // NOWAIT: a second concurrent click fails fast instead of double-refunding.
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update", { noWait: true });
    if (!refund) throw new DomainError("Refund not found.", "not_found");
    if (refund.status === "processed") return refund;
    if (refund.providerRefundId && refund.status === "pending") {
      throw new DomainError("This refund was already submitted and is awaiting confirmation from Razorpay.", "conflict");
    }
    const [pay] = await tx.select().from(payments).where(eq(payments.id, refund.paymentId));
    if (!pay?.paymentId) throw new DomainError("No captured payment found for this refund.", "conflict");

    let status: "pending" | "processed" | "failed" = "pending";
    let providerRefundId: string | null = refund.providerRefundId;
    let failureReason: string | null = null;

    if (pay.provider === "mock") {
      status = "processed";
      providerRefundId = `rfnd_mock_${refund.id.slice(0, 8)}`;
    } else if (paymentMode() === "razorpay") {
      try {
        const r = await createRazorpayRefund({ paymentId: pay.paymentId, amountPaise: refund.amountPaise, receipt: refund.id.slice(0, 40) });
        providerRefundId = r.id;
        status = r.status === "processed" ? "processed" : r.status === "failed" ? "failed" : "pending";
      } catch (e) {
        status = "failed";
        failureReason = e instanceof Error ? e.message.slice(0, 300) : "Refund request failed";
      }
    } else {
      throw new DomainError("Razorpay Test Mode keys aren't configured, so this refund can't be submitted.", "unavailable");
    }

    const now = new Date();
    const [updated] = await tx
      .update(refunds)
      .set({
        status,
        providerRefundId,
        failureReason,
        attempts: refund.attempts + 1,
        processedAt: status === "processed" ? now : null,
        updatedAt: now,
      })
      .where(eq(refunds.id, refund.id))
      .returning();
    await tx.update(bookings).set({ refundStatus: status, updatedAt: now }).where(eq(bookings.id, refund.bookingId));
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, refund.bookingId));
    await audit(tx, {
      actorId: admin.id,
      action: `refund.${status}`,
      entityType: "refund",
      entityId: refund.id,
      eventId: refund.eventId,
      details: { reference: b?.reference, amountPaise: refund.amountPaise, providerRefundId, failureReason, testMode: true },
    });
    if (b && status !== "pending") {
      await notify(tx, {
        userId: b.userId,
        type: `refund.${status}`,
        title: status === "processed" ? "Refund processed (test mode)" : "Refund attempt failed",
        body:
          status === "processed"
            ? `The refund for ${b.reference} was processed in Razorpay Test Mode. No real money was moved.`
            : `We couldn't process the refund for ${b.reference} yet. An administrator will retry.`,
        href: `/my/bookings/${b.id}`,
      });
    }
    return updated!;
  });
}

/** Apply a refund status reported by a Razorpay webhook. Idempotent. */
export async function applyRefundWebhook(providerRefundId: string, status: "processed" | "failed", reason?: string) {
  return db.transaction(async (tx) => {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)).for("update");
    if (!refund || refund.status === status || refund.status === "processed") return false;
    const now = new Date();
    await tx
      .update(refunds)
      .set({ status, failureReason: reason?.slice(0, 300) ?? null, processedAt: status === "processed" ? now : null, updatedAt: now })
      .where(eq(refunds.id, refund.id));
    await tx.update(bookings).set({ refundStatus: status, updatedAt: now }).where(eq(bookings.id, refund.bookingId));
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, refund.bookingId));
    await audit(tx, {
      actorId: null,
      action: `refund.${status}`,
      entityType: "refund",
      entityId: refund.id,
      eventId: refund.eventId,
      details: { providerRefundId, via: "webhook" },
    });
    if (b) {
      await notify(tx, {
        userId: b.userId,
        type: `refund.${status}`,
        title: status === "processed" ? "Refund processed (test mode)" : "Refund attempt failed",
        body: `Refund for ${b.reference}: ${status}.`,
        href: `/my/bookings/${b.id}`,
      });
    }
    return true;
  });
}
