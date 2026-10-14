import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  checkIns,
  events,
  payments,
  profiles,
  ticketTiers,
  type Event,
  type EventCategory,
  type Profile,
  type TicketTier,
} from "@/db/schema";
import { fromLocalInput } from "@/lib/format";
import { slugify } from "@/lib/domain/tokens";
import { INVENTORY_HOLDING } from "@/lib/domain/transitions";
import type { EventParsed } from "@/lib/validation/event";
import { audit, notify } from "./audit";
import { assertCanManageEvent, expireHolds } from "./bookings";
import { DomainError, pgErrorCode } from "./errors";

/* ----------------------------------------------------------------------------
 * Public discovery
 * ------------------------------------------------------------------------- */

export type EventCard = Event & {
  organizerName: string;
  minPricePaise: number | null;
  maxPricePaise: number | null;
  capacity: number;
  remaining: number;
};

/** Correlated subqueries need a qualified outer reference; drizzle omits the table name on single-table selects. */
const EVENT_ID = sql.raw(`"events"."id"`);

const cardColumns = {
  organizerName: profiles.fullName,
  minPricePaise: sql<number | null>`(select min(price_paise) from ticket_tiers t where t.event_id = ${EVENT_ID})`,
  maxPricePaise: sql<number | null>`(select max(price_paise) from ticket_tiers t where t.event_id = ${EVENT_ID})`,
  capacity: sql<number>`coalesce((select sum(capacity) from ticket_tiers t where t.event_id = ${EVENT_ID}), 0)::int`,
  remaining: sql<number>`coalesce((select sum(capacity - allocated) from ticket_tiers t where t.event_id = ${EVENT_ID}), 0)::int`,
};

function toCard(row: { event: Event } & Omit<EventCard, keyof Event>): EventCard {
  const { event, ...rest } = row;
  return { ...event, ...rest };
}

/** Builds a prefix-matching tsquery from free text: "robo work" -> 'robo':* & 'work':* */
export function buildTsQuery(q: string) {
  const terms = q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .slice(0, 6);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

export type SearchParams = {
  q?: string;
  category?: EventCategory;
  from?: Date;
  to?: Date;
  venue?: string;
  available?: boolean;
  free?: boolean;
  when?: "upcoming" | "past";
  page?: number;
  pageSize?: number;
};

export async function searchEvents(params: SearchParams) {
  await expireHolds();
  const pageSize = Math.min(params.pageSize ?? 12, 48);
  const page = Math.max(1, Math.min(params.page ?? 1, 100));
  const conds: SQL[] = [eq(events.visibility, "public"), ne(events.status, "draft")];
  const now = new Date();

  if (params.when === "past") conds.push(lte(events.endAt, now));
  else conds.push(gte(events.endAt, now), eq(events.status, "published"));

  const tsq = params.q ? buildTsQuery(params.q) : null;
  if (tsq) conds.push(sql`${events.search} @@ to_tsquery('english', ${tsq})`);
  if (params.category) conds.push(eq(events.category, params.category));
  if (params.from) conds.push(gte(events.startAt, params.from));
  if (params.to) conds.push(lte(events.startAt, params.to));
  if (params.venue) conds.push(ilike(events.venue, `%${params.venue.replace(/[%_\\]/g, "\\$&")}%`));
  if (params.available)
    conds.push(sql`exists (select 1 from ticket_tiers t where t.event_id = ${EVENT_ID} and t.allocated < t.capacity)`);
  if (params.free) conds.push(sql`exists (select 1 from ticket_tiers t where t.event_id = ${EVENT_ID} and t.price_paise = 0)`);

  const where = and(...conds);
  const order = tsq
    ? [desc(sql`ts_rank(${events.search}, to_tsquery('english', ${tsq}))`), asc(events.startAt)]
    : params.when === "past"
      ? [desc(events.startAt)]
      : [asc(events.startAt)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ event: events, ...cardColumns })
      .from(events)
      .innerJoin(profiles, eq(profiles.id, events.organizerId))
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(events).where(where),
  ]);

  return { items: rows.map(toCard), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function featuredEvents(limit = 6) {
  await expireHolds();
  const now = new Date();
  const rows = await db
    .select({ event: events, ...cardColumns })
    .from(events)
    .innerJoin(profiles, eq(profiles.id, events.organizerId))
    .where(and(eq(events.visibility, "public"), eq(events.status, "published"), gte(events.endAt, now)))
    .orderBy(asc(events.startAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function categoryCounts() {
  const now = new Date();
  return db
    .select({ category: events.category, n: count() })
    .from(events)
    .where(and(eq(events.visibility, "public"), eq(events.status, "published"), gte(events.endAt, now)))
    .groupBy(events.category);
}

export async function venues() {
  const rows = await db
    .selectDistinct({ venue: events.venue })
    .from(events)
    .where(and(eq(events.visibility, "public"), eq(events.status, "published")))
    .orderBy(asc(events.venue))
    .limit(50);
  return rows.map((r) => r.venue);
}

/** Load an event by slug for the detail page. Drafts are only visible to their organizer and admins. */
export async function getEventForViewer(slug: string, viewer: Profile | null) {
  const [row] = await db
    .select({ event: events, organizerName: profiles.fullName })
    .from(events)
    .innerJoin(profiles, eq(profiles.id, events.organizerId))
    .where(eq(events.slug, slug))
    .limit(1);
  if (!row) return null;
  const canManage = viewer && (viewer.role === "admin" || viewer.id === row.event.organizerId);
  if (row.event.status === "draft" && !canManage) return null;

  await expireHolds({ eventId: row.event.id });
  const tiers = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, row.event.id))
    .orderBy(asc(ticketTiers.sortOrder), asc(ticketTiers.pricePaise));

  let heldByViewer = 0;
  if (viewer) {
    const [{ held }] = await db
      .select({ held: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int` })
      .from(bookings)
      .where(
        and(eq(bookings.eventId, row.event.id), eq(bookings.userId, viewer.id), inArray(bookings.status, [...INVENTORY_HOLDING])),
      );
    heldByViewer = held;
  }
  return { event: row.event, organizerName: row.organizerName, tiers, canManage: Boolean(canManage), heldByViewer };
}

/* ----------------------------------------------------------------------------
 * Organizer CRUD
 * ------------------------------------------------------------------------- */

function eventValues(input: EventParsed) {
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    category: input.category,
    venue: input.venue,
    startAt: fromLocalInput(input.startAt),
    endAt: fromLocalInput(input.endAt),
    registrationClosesAt: fromLocalInput(input.registrationClosesAt),
    checkinOpensAt: fromLocalInput(input.checkinOpensAt),
    checkinClosesAt: fromLocalInput(input.checkinClosesAt),
    visibility: input.visibility,
    maxTicketsPerBooking: input.maxTicketsPerBooking,
    eligibleCategories: input.eligibleCategories,
    allowPassRequests: input.allowPassRequests,
  };
}

const toPaise = (rupees: number) => Math.round(rupees * 100);

export async function createEvent(organizer: Profile, input: EventParsed, publish: boolean) {
  if (organizer.role !== "organizer" && organizer.role !== "admin") {
    throw new DomainError("Only approved organizers can create events.", "forbidden");
  }
  return db.transaction(async (tx) => {
    const now = new Date();
    const [event] = await tx
      .insert(events)
      .values({
        ...eventValues(input),
        slug: slugify(input.title),
        organizerId: organizer.id,
        status: publish ? "published" : "draft",
        publishedAt: publish ? now : null,
      })
      .returning();
    await tx.insert(ticketTiers).values(
      input.tiers.map((t, i) => ({
        eventId: event!.id,
        name: t.name,
        description: t.description ?? "",
        pricePaise: toPaise(t.priceRupees),
        capacity: t.capacity,
        sortOrder: i,
      })),
    );
    await audit(tx, {
      actorId: organizer.id,
      action: publish ? "event.created_published" : "event.created",
      entityType: "event",
      entityId: event!.id,
      eventId: event!.id,
      details: { title: event!.title, tiers: input.tiers.length },
    });
    return event!;
  });
}

export async function updateEvent(actor: Profile, eventId: string, input: EventParsed) {
  try {
    return await db.transaction(async (tx) => {
      await assertCanManageEvent(tx, actor, eventId);
      const [current] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
      if (!current) throw new DomainError("Event not found.", "not_found");
      if (current.status === "cancelled") throw new DomainError("Cancelled events can't be edited.", "closed");

      const [updated] = await tx
        .update(events)
        .set({ ...eventValues(input), updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();

      const existing = await tx.select().from(ticketTiers).where(eq(ticketTiers.eventId, eventId)).for("update");
      const keepIds = input.tiers.map((t) => t.id).filter((id): id is string => Boolean(id));

      // Remove tiers dropped from the form — only if nothing was ever booked against them.
      const removed = existing.filter((t) => !keepIds.includes(t.id));
      for (const t of removed) {
        if (t.allocated > 0) throw new DomainError(`"${t.name}" has bookings and can't be removed. Reduce its capacity instead.`, "conflict");
      }
      if (removed.length) {
        try {
          await tx.transaction(async (sp) => {
            await sp.delete(ticketTiers).where(inArray(ticketTiers.id, removed.map((t) => t.id)));
          });
        } catch {
          throw new DomainError("A removed tier has booking history and can't be deleted.", "conflict");
        }
      }

      for (const [i, t] of input.tiers.entries()) {
        const values = {
          name: t.name,
          description: t.description ?? "",
          pricePaise: toPaise(t.priceRupees),
          capacity: t.capacity,
          sortOrder: i,
        };
        const match = t.id ? existing.find((e) => e.id === t.id) : undefined;
        if (match) {
          if (t.capacity < match.allocated) {
            throw new DomainError(`"${t.name}" already has ${match.allocated} seats taken; capacity can't go below that.`, "conflict");
          }
          await tx.update(ticketTiers).set(values).where(eq(ticketTiers.id, match.id));
        } else {
          await tx.insert(ticketTiers).values({ ...values, eventId });
        }
      }

      await audit(tx, {
        actorId: actor.id,
        action: "event.updated",
        entityType: "event",
        entityId: eventId,
        eventId,
        details: { title: updated!.title },
      });
      return updated!;
    });
  } catch (err) {
    const pg = pgErrorCode(err);
    if (pg.code === "23505" && pg.constraint === "ticket_tiers_event_name_key") throw new DomainError("Tier names must be unique.");
    if (pg.code === "23514") throw new DomainError("Some values are out of range. Check dates and capacities.");
    throw err;
  }
}

export async function setPoster(actor: Profile, eventId: string, posterPath: string | null) {
  return db.transaction(async (tx) => {
    await assertCanManageEvent(tx, actor, eventId);
    const [prev] = await tx.select({ posterPath: events.posterPath }).from(events).where(eq(events.id, eventId));
    await tx.update(events).set({ posterPath, updatedAt: new Date() }).where(eq(events.id, eventId));
    await audit(tx, {
      actorId: actor.id,
      action: posterPath ? "event.poster_updated" : "event.poster_removed",
      entityType: "event",
      entityId: eventId,
      eventId,
    });
    return prev?.posterPath ?? null;
  });
}

export async function setPublished(actor: Profile, eventId: string, publish: boolean, note?: string) {
  return db.transaction(async (tx) => {
    const event = await assertCanManageEvent(tx, actor, eventId);
    if (event.status === "cancelled") throw new DomainError("Cancelled events can't be republished.", "closed");
    if (publish) {
      const [{ n }] = await tx.select({ n: count() }).from(ticketTiers).where(eq(ticketTiers.eventId, eventId));
      if (n === 0) throw new DomainError("Add at least one ticket tier before publishing.");
      if (event.endAt <= new Date()) throw new DomainError("This event has already ended.");
    }
    const [row] = await tx
      .update(events)
      .set({
        status: publish ? "published" : "draft",
        publishedAt: publish ? (event.publishedAt ?? new Date()) : event.publishedAt,
        adminNote: actor.role === "admin" && !publish ? (note?.trim() || "Unpublished by an administrator") : event.adminNote,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();
    await audit(tx, {
      actorId: actor.id,
      action: publish ? "event.published" : "event.unpublished",
      entityType: "event",
      entityId: eventId,
      eventId,
      details: { byAdmin: actor.role === "admin", note: note?.slice(0, 200) },
    });
    if (actor.role === "admin" && actor.id !== event.organizerId && !publish) {
      await notify(tx, {
        userId: event.organizerId,
        type: "event.unpublished",
        title: "Event unpublished by an administrator",
        body: `${event.title}${note ? `: ${note}` : ""}`,
        href: `/organizer/events/${eventId}`,
      });
    }
    return row!;
  });
}

/* ----------------------------------------------------------------------------
 * Organizer dashboard queries
 * ------------------------------------------------------------------------- */

export type EventWithMetrics = Event & {
  capacity: number;
  allocated: number;
  approved: number;
  pending: number;
  revenuePaise: number;
  checkedIn: number;
};

export async function eventsWithMetrics(filter: { organizerId?: string; status?: Event["status"][] } = {}) {
  const conds: SQL[] = [];
  if (filter.organizerId) conds.push(eq(events.organizerId, filter.organizerId));
  if (filter.status?.length) conds.push(inArray(events.status, filter.status));
  const rows = await db
    .select({
      event: events,
      capacity: sql<number>`coalesce((select sum(capacity) from ticket_tiers t where t.event_id = ${EVENT_ID}), 0)::int`,
      allocated: sql<number>`coalesce((select sum(allocated) from ticket_tiers t where t.event_id = ${EVENT_ID}), 0)::int`,
      approved: sql<number>`coalesce((select sum(quantity) from bookings b where b.event_id = ${EVENT_ID} and b.status = 'approved'), 0)::int`,
      pending: sql<number>`(select count(*) from bookings b where b.event_id = ${EVENT_ID} and b.status = 'pending_verification')::int`,
      revenuePaise: sql<number>`coalesce((select sum(p.amount_paise) from payments p join bookings b on b.id = p.booking_id where b.event_id = ${EVENT_ID} and p.status = 'paid'), 0)::int`,
      checkedIn: sql<number>`(select count(*) from check_ins c where c.event_id = ${EVENT_ID})::int`,
    })
    .from(events)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(events.startAt));
  return rows.map(({ event, ...m }) => ({ ...event, ...m })) as EventWithMetrics[];
}

export async function getManagedEvent(actor: Profile, eventId: string) {
  const event = await assertCanManageEvent(db, actor, eventId).catch(() => null);
  if (!event) return null;
  await expireHolds({ eventId });
  const tiers = await db.select().from(ticketTiers).where(eq(ticketTiers.eventId, eventId)).orderBy(asc(ticketTiers.sortOrder));
  const [[metrics], [{ checkedIn }]] = await Promise.all([
    db
      .select({
        pending: sql<number>`count(*) filter (where ${bookings.status} = 'pending_verification')::int`,
        approved: sql<number>`coalesce(sum(${bookings.quantity}) filter (where ${bookings.status} = 'approved'), 0)::int`,
        awaiting: sql<number>`count(*) filter (where ${bookings.status} = 'awaiting_payment')::int`,
        passes: sql<number>`count(*) filter (where ${bookings.kind} = 'complimentary' and ${bookings.status} = 'pending_verification')::int`,
      })
      .from(bookings)
      .where(eq(bookings.eventId, eventId)),
    db.select({ checkedIn: count() }).from(checkIns).where(eq(checkIns.eventId, eventId)),
  ]);
  const [{ revenue }] = await db
    .select({ revenue: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .where(and(eq(bookings.eventId, eventId), eq(payments.status, "paid"), ne(bookings.status, "payment_exception")));
  return { event, tiers: tiers as TicketTier[], metrics: { ...metrics!, checkedIn, revenuePaise: revenue } };
}

export async function upcomingCount() {
  const [{ n }] = await db
    .select({ n: count() })
    .from(events)
    .where(and(eq(events.status, "published"), gte(events.endAt, new Date()), notInArray(events.visibility, ["unlisted"])));
  return n;
}

