import "server-only";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, type DbOrTx, type Tx } from "@/db";
import {
  bookingItems,
  bookings,
  events,
  profiles,
  ticketTiers,
  tickets,
  type Booking,
  type BookingStatus,
  type Profile,
} from "@/db/schema";
import { HOLD_MINUTES } from "@/lib/constants";
import { priceOrder, PricingError, type LineRequest } from "@/lib/domain/pricing";
import { bookingReference, eventCode, qrToken, ticketNumber } from "@/lib/domain/tokens";
import { assertBookingTransition, INVENTORY_HOLDING } from "@/lib/domain/transitions";
import { audit, notify, notifyAdmins } from "./audit";
import { DomainError, pgErrorCode } from "./errors";

/* ----------------------------------------------------------------------------
 * Inventory primitives — every change to ticket_tiers.allocated goes through
 * these two functions, always inside the same transaction as the booking
 * status change that justifies it.
 * ------------------------------------------------------------------------- */

/** Atomically reserve seats. Throws (rolling back the transaction) if any tier lacks capacity. */
export async function reserveInventory(tx: Tx, eventId: string, items: { tierId: string; quantity: number }[]) {
  // Sorted order prevents deadlocks between concurrent multi-tier bookings.
  for (const item of [...items].sort((a, b) => a.tierId.localeCompare(b.tierId))) {
    const updated = await tx
      .update(ticketTiers)
      .set({ allocated: sql`${ticketTiers.allocated} + ${item.quantity}` })
      .where(
        and(
          eq(ticketTiers.id, item.tierId),
          eq(ticketTiers.eventId, eventId),
          sql`${ticketTiers.allocated} + ${item.quantity} <= ${ticketTiers.capacity}`,
        ),
      )
      .returning({ id: ticketTiers.id });
    if (updated.length === 0) {
      throw new DomainError("Sorry — not enough tickets left in that tier.", "sold_out");
    }
  }
}

export async function releaseInventory(tx: Tx, bookingId: string) {
  const items = await tx
    .select({ tierId: bookingItems.tierId, quantity: bookingItems.quantity })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))
    .orderBy(asc(bookingItems.tierId));
  for (const item of items) {
    await tx
      .update(ticketTiers)
      .set({ allocated: sql`greatest(${ticketTiers.allocated} - ${item.quantity}, 0)` })
      .where(eq(ticketTiers.id, item.tierId));
  }
}

/** Compare-and-set status update. Returns the updated row or null if the booking moved on. */
export async function transitionBooking(
  tx: DbOrTx,
  bookingId: string,
  from: BookingStatus | BookingStatus[],
  to: BookingStatus,
  patch: Partial<typeof bookings.$inferInsert> = {},
) {
  const fromList = Array.isArray(from) ? from : [from];
  fromList.forEach((f) => assertBookingTransition(f, to));
  const [row] = await tx
    .update(bookings)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), inArray(bookings.status, fromList)))
    .returning();
  return row ?? null;
}

/* ----------------------------------------------------------------------------
 * Reservation expiry — safe to call any number of times, from anywhere.
 * ------------------------------------------------------------------------- */

export async function expireHolds(filter: { eventId?: string; userId?: string; bookingId?: string } = {}) {
  const conds = [eq(bookings.status, "awaiting_payment"), lt(bookings.expiresAt, new Date())];
  if (filter.eventId) conds.push(eq(bookings.eventId, filter.eventId));
  if (filter.userId) conds.push(eq(bookings.userId, filter.userId));
  if (filter.bookingId) conds.push(eq(bookings.id, filter.bookingId));

  const stale = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conds))
    .limit(200);

  let expired = 0;
  for (const { id } of stale) {
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookings)
        .set({ status: "expired", paymentStatus: "expired", expiresAt: null, updatedAt: new Date() })
        .where(and(eq(bookings.id, id), eq(bookings.status, "awaiting_payment"), lt(bookings.expiresAt, new Date())))
        .returning();
      if (!row) return false; // already handled by a concurrent call or a payment
      await releaseInventory(tx, id);
      await audit(tx, {
        actorId: null,
        action: "booking.expired",
        entityType: "booking",
        entityId: id,
        eventId: row.eventId,
        details: { reference: row.reference, quantity: row.quantity },
      });
      await notify(tx, {
        userId: row.userId,
        type: "booking.expired",
        title: "Reservation expired",
        body: `Booking ${row.reference} was released because payment wasn't completed within ${HOLD_MINUTES} minutes.`,
        href: `/my/bookings/${id}`,
      });
      return true;
    });
    if (done) expired++;
  }
  return expired;
}

/* ----------------------------------------------------------------------------
 * Create booking
 * ------------------------------------------------------------------------- */

export type CreateBookingInput = {
  eventId: string;
  lines: LineRequest[];
  attendeeNames: string[];
  idempotencyKey: string;
  complimentary?: { reason: string };
};

export async function createBooking(user: Profile, input: CreateBookingInput): Promise<Booking> {
  const existing = await findByIdempotencyKey(user.id, input.idempotencyKey);
  if (existing) return existing;

  await expireHolds({ eventId: input.eventId });

  try {
    return await db.transaction(async (tx) => {
      // Serialise this user's bookings (per-user limits) and lock the event
      // against a concurrent cancellation.
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, user.id)).for("update");
      const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("share");
      if (!event || event.status === "draft") throw new DomainError("This event isn't open for registration.", "not_found");
      if (event.status === "cancelled") throw new DomainError("This event has been cancelled.", "closed");
      const now = new Date();
      if (now >= event.registrationClosesAt) throw new DomainError("Registration for this event has closed.", "closed");
      if (!event.eligibleCategories.includes(user.category)) {
        throw new DomainError("Your participant category isn't eligible for this event.", "forbidden");
      }
      if (input.complimentary && !event.allowPassRequests) {
        throw new DomainError("This event doesn't accept complimentary pass requests.", "forbidden");
      }

      const tiers = await tx.select().from(ticketTiers).where(eq(ticketTiers.eventId, event.id));
      let priced;
      try {
        priced = priceOrder(input.lines, tiers, event.maxTicketsPerBooking);
      } catch (e) {
        if (e instanceof PricingError) throw new DomainError(e.message);
        throw e;
      }

      // Per-user cap across live bookings for this event.
      const [{ held }] = await tx
        .select({ held: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.eventId, event.id),
            eq(bookings.userId, user.id),
            inArray(bookings.status, [...INVENTORY_HOLDING]),
          ),
        );
      if (held + priced.quantity > event.maxTicketsPerBooking) {
        throw new DomainError(
          held > 0
            ? `You already hold ${held} ticket(s) for this event; the limit is ${event.maxTicketsPerBooking} per person.`
            : `You can book up to ${event.maxTicketsPerBooking} tickets.`,
          "conflict",
        );
      }

      const names = normaliseNames(input.attendeeNames, priced.quantity, user.fullName);

      const kind = input.complimentary ? "complimentary" : priced.amountPaise > 0 ? "paid" : "free";
      const amountPaise = kind === "paid" ? priced.amountPaise : 0;
      const isPaid = kind === "paid";

      await reserveInventory(tx, event.id, priced.items);

      const [booking] = await tx
        .insert(bookings)
        .values({
          reference: bookingReference(),
          eventId: event.id,
          userId: user.id,
          kind,
          status: isPaid ? "awaiting_payment" : "pending_verification",
          paymentStatus: isPaid ? "pending" : "not_required",
          quantity: priced.quantity,
          amountPaise,
          attendeeNames: names,
          passReason: input.complimentary?.reason.trim() || null,
          expiresAt: isPaid ? new Date(now.getTime() + HOLD_MINUTES * 60_000) : null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      await tx.insert(bookingItems).values(
        priced.items.map((i) => ({
          bookingId: booking!.id,
          tierId: i.tierId,
          quantity: i.quantity,
          unitPricePaise: kind === "complimentary" ? 0 : i.unitPricePaise,
        })),
      );

      await audit(tx, {
        actorId: user.id,
        action: "booking.created",
        entityType: "booking",
        entityId: booking!.id,
        eventId: event.id,
        details: { reference: booking!.reference, kind, quantity: priced.quantity, amountPaise },
      });

      const href = `/my/bookings/${booking!.id}`;
      await notify(tx, {
        userId: user.id,
        type: "booking.created",
        title: isPaid
          ? "Tickets reserved — complete payment"
          : kind === "complimentary"
            ? "Pass request submitted"
            : "Registration submitted",
        body: isPaid
          ? `${priced.quantity} ticket(s) for ${event.title} are held for ${HOLD_MINUTES} minutes.`
          : `${event.title}: the organizer will review your ${kind === "complimentary" ? "pass request" : "registration"}.`,
        href,
      });
      if (!isPaid) {
        await notify(tx, {
          userId: event.organizerId,
          type: "booking.needs_review",
          title: kind === "complimentary" ? "New pass request" : "New registration to verify",
          body: `${user.fullName} · ${priced.quantity} ticket(s) · ${event.title}`,
          href: `/organizer/events/${event.id}/bookings`,
        });
      }

      return booking!;
    });
  } catch (err) {
    const pg = pgErrorCode(err);
    if (pg.code === "23505" && pg.constraint === "bookings_idempotency_key") {
      const again = await findByIdempotencyKey(user.id, input.idempotencyKey);
      if (again) return again;
    }
    if (pg.code === "23514" && pg.constraint === "ticket_tiers_allocation") {
      throw new DomainError("Sorry — not enough tickets left in that tier.", "sold_out");
    }
    throw err;
  }
}

function normaliseNames(names: string[], quantity: number, fallback: string) {
  return Array.from({ length: quantity }, (_, i) => {
    const n = (names[i] ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    return n || fallback;
  });
}

async function findByIdempotencyKey(userId: string, key: string) {
  const [row] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.idempotencyKey, key)))
    .limit(1);
  return row ?? null;
}

/* ----------------------------------------------------------------------------
 * Participant cancellation (unpaid only)
 * ------------------------------------------------------------------------- */

export async function cancelOwnBooking(user: Profile, bookingId: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!b || b.userId !== user.id) throw new DomainError("Booking not found.", "not_found");

    const unpaidHold = b.status === "awaiting_payment" && b.paymentStatus !== "paid";
    const unpaidRequest = b.status === "pending_verification" && b.paymentStatus === "not_required";
    if (!unpaidHold && !unpaidRequest) {
      throw new DomainError(
        b.paymentStatus === "paid"
          ? "Paid bookings can't be cancelled in the app. Refunds are only issued if the event is officially cancelled."
          : "This booking can no longer be cancelled.",
        "conflict",
      );
    }

    const row = await transitionBooking(tx, b.id, b.status, "cancelled", {
      cancelledAt: new Date(),
      expiresAt: null,
      paymentStatus: b.paymentStatus === "not_required" ? "not_required" : "expired",
    });
    if (!row) throw new DomainError("This booking just changed. Refresh and try again.", "conflict");
    await releaseInventory(tx, b.id);
    await audit(tx, {
      actorId: user.id,
      action: "booking.cancelled",
      entityType: "booking",
      entityId: b.id,
      eventId: b.eventId,
      details: { reference: b.reference, previous: b.status },
    });
    await notify(tx, {
      userId: user.id,
      type: "booking.cancelled",
      title: "Booking cancelled",
      body: `Booking ${b.reference} was cancelled and its tickets released.`,
      href: `/my/bookings/${b.id}`,
    });
    return row;
  });
}

/* ----------------------------------------------------------------------------
 * Organizer verification
 * ------------------------------------------------------------------------- */

export async function assertCanManageEvent(tx: DbOrTx, actor: Profile, eventId: string) {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new DomainError("Event not found.", "not_found");
  if (actor.role === "admin") return event;
  if (actor.role === "organizer" && event.organizerId === actor.id) return event;
  throw new DomainError("You can only manage your own events.", "forbidden");
}

export async function decideBooking(actor: Profile, bookingId: string, decision: "approve" | "reject", note?: string) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!b) throw new DomainError("Booking not found.", "not_found");
    const event = await assertCanManageEvent(tx, actor, b.eventId);

    if (b.status !== "pending_verification") {
      throw new DomainError("This booking has already been decided or is no longer pending.", "conflict");
    }
    if (b.paymentStatus !== "paid" && b.paymentStatus !== "not_required") {
      throw new DomainError("Payment hasn't been verified for this booking.", "conflict");
    }
    if (event.status === "cancelled") throw new DomainError("The event has been cancelled.", "closed");

    const trimmed = note?.trim().slice(0, 500) || null;
    const href = `/my/bookings/${b.id}`;

    if (decision === "approve") {
      const row = await transitionBooking(tx, b.id, "pending_verification", "approved", {
        decidedBy: actor.id,
        decidedAt: new Date(),
        decisionNote: trimmed,
      });
      if (!row) throw new DomainError("This booking just changed. Refresh and try again.", "conflict");
      const issued = await issueTickets(tx, row, event.title);
      await audit(tx, {
        actorId: actor.id,
        action: "booking.approved",
        entityType: "booking",
        entityId: b.id,
        eventId: b.eventId,
        details: { reference: b.reference, kind: b.kind, ticketsIssued: issued },
      });
      await notify(tx, {
        userId: b.userId,
        type: "booking.approved",
        title: b.kind === "complimentary" ? "Pass approved — tickets ready" : "Booking approved — tickets ready",
        body: `${event.title}: ${b.quantity} ticket(s) are now valid. Download them anytime.`,
        href,
      });
      return row;
    }

    const paid = b.paymentStatus === "paid";
    const row = await transitionBooking(tx, b.id, "pending_verification", "rejected", {
      decidedBy: actor.id,
      decidedAt: new Date(),
      decisionNote: trimmed,
      exceptionReason: paid ? "Rejected by organizer after payment — requires administrative handling." : null,
    });
    if (!row) throw new DomainError("This booking just changed. Refresh and try again.", "conflict");
    await releaseInventory(tx, b.id);
    await audit(tx, {
      actorId: actor.id,
      action: "booking.rejected",
      entityType: "booking",
      entityId: b.id,
      eventId: b.eventId,
      details: { reference: b.reference, kind: b.kind, paid },
    });
    await notify(tx, {
      userId: b.userId,
      type: "booking.rejected",
      title: b.kind === "complimentary" ? "Pass request declined" : "Booking not approved",
      body: paid
        ? `${event.title}: the organizer couldn't approve booking ${b.reference}. Your payment has been flagged for administrative review.`
        : `${event.title}: the organizer couldn't approve this request.${trimmed ? ` Note: ${trimmed}` : ""}`,
      href,
    });
    if (paid) {
      await notifyAdmins(tx, {
        type: "payment.exception",
        title: "Paid booking rejected",
        body: `${b.reference} (${event.title}) was rejected after payment and needs handling.`,
        href: "/admin/exceptions",
      });
    }
    return row;
  });
}

/** Issue one ticket per seat. Idempotent: (booking_id, seq) is unique. */
async function issueTickets(tx: Tx, booking: Booking, eventTitle: string) {
  const items = await tx
    .select()
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, booking.id))
    .orderBy(asc(bookingItems.tierId));
  const code = eventCode(eventTitle);
  const rows: (typeof tickets.$inferInsert)[] = [];
  let seq = 0;
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      rows.push({
        bookingId: booking.id,
        eventId: booking.eventId,
        tierId: item.tierId,
        seq: seq + 1,
        ticketNumber: ticketNumber(code),
        qrToken: qrToken(),
        attendeeName: booking.attendeeNames[seq] ?? booking.attendeeNames[0]!,
      });
      seq++;
    }
  }
  const inserted = await tx
    .insert(tickets)
    .values(rows)
    .onConflictDoNothing({ target: [tickets.bookingId, tickets.seq] })
    .returning({ id: tickets.id });
  return inserted.length;
}

/* ----------------------------------------------------------------------------
 * Admin: resolve payment exceptions (manual / off-app handling recorded)
 * ------------------------------------------------------------------------- */

export async function resolveException(admin: Profile, bookingId: string, note: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(bookings)
      .set({
        exceptionResolvedAt: new Date(),
        exceptionResolvedBy: admin.id,
        exceptionNote: note.trim().slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), sql`${bookings.exceptionReason} is not null`, sql`${bookings.exceptionResolvedAt} is null`))
      .returning();
    if (!row) throw new DomainError("Exception not found or already resolved.", "conflict");
    await audit(tx, {
      actorId: admin.id,
      action: "payment.exception_resolved",
      entityType: "booking",
      entityId: row.id,
      eventId: row.eventId,
      details: { reference: row.reference, note: row.exceptionNote },
    });
    await notify(tx, {
      userId: row.userId,
      type: "payment.exception_resolved",
      title: "Payment issue resolved",
      body: `An administrator reviewed booking ${row.reference}: ${row.exceptionNote}`,
      href: `/my/bookings/${row.id}`,
    });
    return row;
  });
}
