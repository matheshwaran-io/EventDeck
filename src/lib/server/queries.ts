import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  auditLogs,
  bookingItems,
  bookings,
  cancellationRequests,
  checkIns,
  events,
  notifications,
  organizerApplications,
  payments,
  payouts,
  profiles,
  refunds,
  ticketTiers,
  tickets,
  type BookingStatus,
  type Profile,
} from "@/db/schema";
import { expireHolds } from "./bookings";

/* ----------------------------------------------------------------------------
 * Participant
 * ------------------------------------------------------------------------- */

export async function myBookings(userId: string) {
  await expireHolds({ userId });
  return db
    .select({
      booking: bookings,
      event: {
        id: events.id,
        slug: events.slug,
        title: events.title,
        venue: events.venue,
        startAt: events.startAt,
        endAt: events.endAt,
        posterPath: events.posterPath,
        category: events.category,
        status: events.status,
      },
      tiers: sql<string>`(select string_agg(t.name || ' × ' || bi.quantity, ', ' order by t.sort_order) from booking_items bi join ticket_tiers t on t.id = bi.tier_id where bi.booking_id = ${bookings.id})`,
    })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt))
    .limit(200);
}

/** Booking detail for its owner, the event's organizer, or an admin. */
export async function bookingDetail(viewer: Profile, bookingId: string) {
  await expireHolds({ bookingId });
  const [row] = await db
    .select({ booking: bookings, event: events, buyer: { fullName: profiles.fullName, email: profiles.email } })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return null;
  const allowed =
    row.booking.userId === viewer.id ||
    viewer.role === "admin" ||
    (viewer.role === "organizer" && row.event.organizerId === viewer.id);
  if (!allowed) return null;

  const [items, ticketRows, paymentRows, refundRows] = await Promise.all([
    db
      .select({ item: bookingItems, tierName: ticketTiers.name })
      .from(bookingItems)
      .innerJoin(ticketTiers, eq(ticketTiers.id, bookingItems.tierId))
      .where(eq(bookingItems.bookingId, bookingId)),
    db
      .select({ ticket: tickets, tierName: ticketTiers.name, checkedInAt: checkIns.scannedAt })
      .from(tickets)
      .innerJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
      .leftJoin(checkIns, eq(checkIns.ticketId, tickets.id))
      .where(eq(tickets.bookingId, bookingId))
      .orderBy(asc(tickets.seq)),
    db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(desc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.bookingId, bookingId)),
  ]);
  return { ...row, items, tickets: ticketRows, payments: paymentRows, refund: refundRows[0] ?? null };
}

export async function myNotifications(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return n;
}

export async function myApplication(userId: string) {
  const [row] = await db
    .select()
    .from(organizerApplications)
    .where(eq(organizerApplications.userId, userId))
    .orderBy(desc(organizerApplications.createdAt))
    .limit(1);
  return row ?? null;
}

/* ----------------------------------------------------------------------------
 * Organizer
 * ------------------------------------------------------------------------- */

export async function eventBookings(eventId: string, filter: "review" | "passes" | "awaiting" | "approved" | "closed" | "all") {
  const conds: SQL[] = [eq(bookings.eventId, eventId)];
  const closed: BookingStatus[] = ["rejected", "cancelled", "expired", "event_cancelled", "payment_exception"];
  if (filter === "review") conds.push(eq(bookings.status, "pending_verification"), sql`${bookings.kind} <> 'complimentary'`);
  if (filter === "passes") conds.push(eq(bookings.kind, "complimentary"), eq(bookings.status, "pending_verification"));
  if (filter === "awaiting") conds.push(eq(bookings.status, "awaiting_payment"));
  if (filter === "approved") conds.push(eq(bookings.status, "approved"));
  if (filter === "closed") conds.push(inArray(bookings.status, closed));
  return db
    .select({
      booking: bookings,
      buyer: { fullName: profiles.fullName, email: profiles.email, category: profiles.category, institution: profiles.institution },
      tiers: sql<string>`(select string_agg(t.name || ' × ' || bi.quantity, ', ' order by t.sort_order) from booking_items bi join ticket_tiers t on t.id = bi.tier_id where bi.booking_id = ${bookings.id})`,
      paymentRef: sql<string | null>`(select p.payment_id from payments p where p.booking_id = ${bookings.id} and p.status = 'paid' order by p.paid_at desc limit 1)`,
    })
    .from(bookings)
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .where(and(...conds))
    .orderBy(filter === "review" || filter === "passes" ? asc(bookings.createdAt) : desc(bookings.createdAt))
    .limit(300);
}

export async function bookingCounts(eventId: string) {
  const [row] = await db
    .select({
      review: sql<number>`count(*) filter (where status = 'pending_verification' and kind <> 'complimentary')::int`,
      passes: sql<number>`count(*) filter (where status = 'pending_verification' and kind = 'complimentary')::int`,
      awaiting: sql<number>`count(*) filter (where status = 'awaiting_payment')::int`,
      approved: sql<number>`count(*) filter (where status = 'approved')::int`,
      closed: sql<number>`count(*) filter (where status in ('rejected','cancelled','expired','event_cancelled','payment_exception'))::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .where(eq(bookings.eventId, eventId));
  return row!;
}

export async function organizerQueue(organizerId: string) {
  return db
    .select({
      booking: bookings,
      eventTitle: events.title,
      eventId: events.id,
      buyer: profiles.fullName,
    })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .where(and(eq(events.organizerId, organizerId), eq(bookings.status, "pending_verification")))
    .orderBy(asc(bookings.createdAt))
    .limit(8);
}

export async function eventCancellationRequests(eventId: string) {
  return db
    .select()
    .from(cancellationRequests)
    .where(eq(cancellationRequests.eventId, eventId))
    .orderBy(desc(cancellationRequests.createdAt));
}

const actor = alias(profiles, "actor");

export async function auditTrail(params: { eventId?: string; eventIds?: string[]; action?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(params.pageSize ?? 50, 100);
  const page = Math.max(1, params.page ?? 1);
  const conds: SQL[] = [];
  if (params.eventId) conds.push(eq(auditLogs.eventId, params.eventId));
  if (params.eventIds) conds.push(params.eventIds.length ? inArray(auditLogs.eventId, params.eventIds) : sql`false`);
  if (params.action) conds.push(sql`${auditLogs.action} like ${`${params.action.replace(/[%_\\]/g, "\\$&")}%`}`);
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ log: auditLogs, actorName: actor.fullName, actorRole: actor.role, eventTitle: events.title })
      .from(auditLogs)
      .leftJoin(actor, eq(actor.id, auditLogs.actorId))
      .leftJoin(events, eq(events.id, auditLogs.eventId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/* ----------------------------------------------------------------------------
 * Admin
 * ------------------------------------------------------------------------- */

export async function adminMetrics() {
  const now = new Date();
  const [[users], [ev], [bk], [pay], [att], [ref], [pendingApps], [pendingCancels], [exceptions], [pendingPayouts]] = await Promise.all([
    db
      .select({
        total: count(),
        organizers: sql<number>`count(*) filter (where role = 'organizer')::int`,
        participants: sql<number>`count(*) filter (where role = 'participant')::int`,
      })
      .from(profiles),
    db
      .select({
        published: sql<number>`count(*) filter (where status = 'published')::int`,
        upcoming: sql<number>`count(*) filter (where status = 'published' and end_at > ${now.toISOString()}::timestamptz)::int`,
        drafts: sql<number>`count(*) filter (where status = 'draft')::int`,
        cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
      })
      .from(events),
    db
      .select({
        bookings: count(),
        ticketsSold: sql<number>`coalesce(sum(quantity) filter (where status = 'approved'), 0)::int`,
        pending: sql<number>`count(*) filter (where status = 'pending_verification')::int`,
      })
      .from(bookings),
    db
      .select({
        totalPaise: sql<number>`coalesce(sum(amount_paise), 0)::bigint`,
        count: count(),
      })
      .from(payments)
      .where(eq(payments.status, "paid")),
    db.select({ n: count() }).from(checkIns),
    db
      .select({
        pending: sql<number>`count(*) filter (where status in ('pending','failed'))::int`,
        processed: sql<number>`count(*) filter (where status = 'processed')::int`,
        processedPaise: sql<number>`coalesce(sum(amount_paise) filter (where status = 'processed'), 0)::bigint`,
      })
      .from(refunds),
    db.select({ n: count() }).from(organizerApplications).where(eq(organizerApplications.status, "pending")),
    db.select({ n: count() }).from(cancellationRequests).where(eq(cancellationRequests.status, "pending")),
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(isNotNull(bookings.exceptionReason), isNull(bookings.exceptionResolvedAt))),
    db.select({ n: count() }).from(payouts).where(eq(payouts.status, "requested")),
  ]);
  return {
    users: users!,
    events: ev!,
    bookings: bk!,
    payments: { totalPaise: Number(pay!.totalPaise), count: pay!.count },
    checkIns: att!.n,
    refunds: { ...ref!, processedPaise: Number(ref!.processedPaise) },
    pendingApplications: pendingApps!.n,
    pendingCancellations: pendingCancels!.n,
    openExceptions: exceptions!.n,
    pendingPayouts: pendingPayouts!.n,
  };
}

export async function salesByDay(days = 14) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${payments.paidAt} at time zone 'Asia/Kolkata'), 'YYYY-MM-DD')`,
      paise: sql<number>`sum(${payments.amountPaise})::int`,
    })
    .from(payments)
    .where(and(eq(payments.status, "paid"), gte(payments.paidAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    const label = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(d);
    return { key, label, paise: rows.find((r) => r.day === key)?.paise ?? 0 };
  });
}

export async function cancellationQueue(status: "pending" | "approved" | "rejected") {
  const reviewer = alias(profiles, "reviewer");
  return db
    .select({
      req: cancellationRequests,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStart: events.startAt,
      requester: profiles.fullName,
      reviewerName: reviewer.fullName,
      bookings: sql<number>`(select count(*) from bookings b where b.event_id = ${events.id} and b.status in ('awaiting_payment','pending_verification','approved'))::int`,
      paidBookings: sql<number>`(select count(*) from bookings b where b.event_id = ${events.id} and b.payment_status = 'paid' and b.status in ('pending_verification','approved'))::int`,
    })
    .from(cancellationRequests)
    .innerJoin(events, eq(events.id, cancellationRequests.eventId))
    .innerJoin(profiles, eq(profiles.id, cancellationRequests.requestedBy))
    .leftJoin(reviewer, eq(reviewer.id, cancellationRequests.reviewedBy))
    .where(eq(cancellationRequests.status, status))
    .orderBy(desc(cancellationRequests.createdAt))
    .limit(100);
}

export async function refundList(status?: "pending" | "processed" | "failed") {
  return db
    .select({
      refund: refunds,
      reference: bookings.reference,
      bookingId: bookings.id,
      buyer: profiles.fullName,
      email: profiles.email,
      eventTitle: events.title,
      provider: payments.provider,
      paymentRef: payments.paymentId,
    })
    .from(refunds)
    .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .innerJoin(events, eq(events.id, refunds.eventId))
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(status ? eq(refunds.status, status) : undefined)
    .orderBy(desc(refunds.createdAt))
    .limit(300);
}

export async function exceptionList(includeResolved: boolean) {
  return db
    .select({
      booking: bookings,
      buyer: profiles.fullName,
      email: profiles.email,
      eventTitle: events.title,
      paidPaise: sql<number>`coalesce((select sum(p.amount_paise) from payments p where p.booking_id = ${bookings.id} and p.status = 'paid'), 0)::int`,
      paymentRefs: sql<string | null>`(select string_agg(p.payment_id, ', ') from payments p where p.booking_id = ${bookings.id} and p.status = 'paid')`,
    })
    .from(bookings)
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(
      and(
        isNotNull(bookings.exceptionReason),
        includeResolved ? undefined : isNull(bookings.exceptionResolvedAt),
      ),
    )
    .orderBy(desc(bookings.updatedAt))
    .limit(200);
}

export async function flaggedPayments() {
  return db
    .select({ payment: payments, reference: bookings.reference, bookingId: bookings.id, eventTitle: events.title })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(isNotNull(payments.flag), or(eq(payments.flag, "duplicate_payment"), eq(payments.flag, "late_payment_recovered"), eq(payments.flag, "paid_after_event_cancellation"))))
    .orderBy(desc(payments.paidAt))
    .limit(100);
}

export async function upcomingForUser(userId: string) {
  return db
    .select({ n: count() })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "approved"), gte(events.endAt, new Date())));
}

