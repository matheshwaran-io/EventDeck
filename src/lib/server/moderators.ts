import "server-only";
import { and, asc, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { eventModerators, events, profiles, type Profile } from "@/db/schema";
import { audit, notify } from "./audit";
import { assertCanManageEvent } from "./bookings";
import { DomainError, pgErrorCode } from "./errors";

export const MAX_MODERATORS_PER_EVENT = 10;

/**
 * Who may scan tickets for an event: platform admins, the owning organizer,
 * and accounts with an active (non-revoked) moderator assignment for THIS event.
 * Checked on every scan, so revocation takes effect immediately.
 */
export async function assertCanScanEvent(tx: DbOrTx, actor: Profile, eventId: string) {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new DomainError("Event not found.", "not_found");
  if (!actor.isActive) throw new DomainError("Your account is deactivated.", "forbidden");
  if (actor.role === "admin") return { event, via: "admin" as const };
  if (actor.role === "organizer" && event.organizerId === actor.id) return { event, via: "organizer" as const };
  const [assignment] = await tx
    .select({ id: eventModerators.id })
    .from(eventModerators)
    .where(and(eq(eventModerators.eventId, eventId), eq(eventModerators.userId, actor.id), isNull(eventModerators.revokedAt)))
    .limit(1);
  if (assignment) return { event, via: "moderator" as const };
  throw new DomainError("You're not a check-in moderator for this event.", "forbidden");
}

export async function canScanEvent(actor: Profile, eventId: string) {
  try {
    return await assertCanScanEvent(db, actor, eventId);
  } catch {
    return null;
  }
}

export async function listModerators(actor: Profile, eventId: string) {
  await assertCanManageEvent(db, actor, eventId);
  return db
    .select({
      moderator: eventModerators,
      name: profiles.fullName,
      email: profiles.email,
      isActive: profiles.isActive,
      scans: sql<number>`(select count(*) from check_ins c where c.event_id = ${eventModerators.eventId} and c.scanned_by = ${eventModerators.userId})::int`,
    })
    .from(eventModerators)
    .innerJoin(profiles, eq(profiles.id, eventModerators.userId))
    .where(eq(eventModerators.eventId, eventId))
    .orderBy(sql`${eventModerators.revokedAt} is not null`, desc(eventModerators.createdAt));
}

export async function addModerator(actor: Profile, eventId: string, rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("Enter a valid email address.");
  try {
    return await db.transaction(async (tx) => {
      const event = await assertCanManageEvent(tx, actor, eventId);
      if (event.status === "cancelled") throw new DomainError("This event is cancelled.", "closed");
      // Serialise concurrent adds for this event so the per-event cap holds.
      await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for("update");

      const [target] = await tx.select().from(profiles).where(sql`lower(${profiles.email}) = ${email}`).limit(1);
      if (!target) {
        throw new DomainError("No EventDeck account uses that email. Ask them to sign up first, then add them here.", "not_found");
      }
      if (!target.isActive) throw new DomainError("That account is deactivated.", "forbidden");
      if (target.id === event.organizerId) throw new DomainError("The event organizer already has full check-in access.", "conflict");
      if (target.role === "admin") throw new DomainError("Administrators already have check-in access to every event.", "conflict");

      const [{ n }] = await tx
        .select({ n: count() })
        .from(eventModerators)
        .where(and(eq(eventModerators.eventId, eventId), isNull(eventModerators.revokedAt)));
      if (n >= MAX_MODERATORS_PER_EVENT) throw new DomainError(`An event can have up to ${MAX_MODERATORS_PER_EVENT} active moderators.`, "conflict");

      const [row] = await tx.insert(eventModerators).values({ eventId, userId: target.id, addedBy: actor.id }).returning();
      await audit(tx, {
        actorId: actor.id,
        action: "moderator.added",
        entityType: "event_moderator",
        entityId: row!.id,
        eventId,
        details: { moderator: target.fullName },
      });
      await notify(tx, {
        userId: target.id,
        type: "moderator.added",
        title: "You're a check-in moderator",
        body: `${actor.fullName} added you to scan tickets for ${event.title}.`,
        href: `/moderate/${eventId}`,
      });
      return { ...row!, name: target.fullName, email: target.email };
    });
  } catch (err) {
    if (pgErrorCode(err).constraint === "event_moderators_one_active") {
      throw new DomainError("That person is already a moderator for this event.", "conflict");
    }
    throw err;
  }
}

export async function revokeModerator(actor: Profile, eventId: string, moderatorId: string) {
  return db.transaction(async (tx) => {
    const event = await assertCanManageEvent(tx, actor, eventId);
    const [row] = await tx
      .update(eventModerators)
      .set({ revokedAt: new Date(), revokedBy: actor.id })
      .where(and(eq(eventModerators.id, moderatorId), eq(eventModerators.eventId, eventId), isNull(eventModerators.revokedAt)))
      .returning();
    if (!row) throw new DomainError("That moderator was already removed.", "conflict");
    const [target] = await tx.select({ name: profiles.fullName }).from(profiles).where(eq(profiles.id, row.userId));
    await audit(tx, {
      actorId: actor.id,
      action: "moderator.revoked",
      entityType: "event_moderator",
      entityId: row.id,
      eventId,
      details: { moderator: target?.name },
    });
    await notify(tx, {
      userId: row.userId,
      type: "moderator.revoked",
      title: "Check-in access removed",
      body: `You can no longer scan tickets for ${event.title}.`,
      href: "/moderate",
    });
    return row;
  });
}

/** Events the user actively moderates (upcoming or recent first). */
export async function moderatedEvents(userId: string) {
  const since = new Date(Date.now() - 2 * 86400_000);
  return db
    .select({
      event: events,
      checkedIn: sql<number>`(select count(*) from check_ins c where c.event_id = "events"."id")::int`,
      myScans: sql<number>`(select count(*) from check_ins c where c.event_id = "events"."id" and c.scanned_by = ${userId})::int`,
    })
    .from(eventModerators)
    .innerJoin(events, eq(events.id, eventModerators.eventId))
    .where(and(eq(eventModerators.userId, userId), isNull(eventModerators.revokedAt), gte(events.endAt, since)))
    .orderBy(asc(events.startAt));
}

export async function moderationCount(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(eventModerators)
    .innerJoin(events, eq(events.id, eventModerators.eventId))
    .where(and(eq(eventModerators.userId, userId), isNull(eventModerators.revokedAt), gte(events.endAt, new Date(Date.now() - 2 * 86400_000))));
  return n;
}

