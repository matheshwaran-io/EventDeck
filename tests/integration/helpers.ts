import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  bookingItems,
  bookings,
  cancellationRequests,
  checkIns,
  events,
  notifications,
  payments,
  profiles,
  refunds,
  ticketTiers,
  tickets,
  type Profile,
} from "@/db/schema";

const created = { users: [] as string[], events: [] as string[] };

export async function makeUser(role: Profile["role"] = "participant", category: Profile["category"] = "host_student") {
  const id = randomUUID();
  const email = `test+${id.slice(0, 8)}@uems.test`;
  await db.execute(sql`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${email}, '', now(),
            ${JSON.stringify({ full_name: `Test ${role} ${id.slice(0, 4)}`, category })}::jsonb, '{}'::jsonb, now(), now())`);
  if (role !== "participant") await db.update(profiles).set({ role }).where(eq(profiles.id, id));
  created.users.push(id);
  const [p] = await db.select().from(profiles).where(eq(profiles.id, id));
  return p!;
}

export async function makeEvent(
  organizer: Profile,
  opts: {
    tiers?: { name: string; pricePaise: number; capacity: number }[];
    maxPerBooking?: number;
    registrationClosesAt?: Date;
    checkinOpensAt?: Date;
    checkinClosesAt?: Date;
    allowPassRequests?: boolean;
    eligible?: Profile["category"][];
    status?: "draft" | "published";
  } = {},
) {
  const now = Date.now();
  const [event] = await db
    .insert(events)
    .values({
      slug: `test-${randomUUID().slice(0, 8)}`,
      organizerId: organizer.id,
      title: "Integration Test Event",
      summary: "An event created by the integration test suite",
      venue: "Test Hall",
      startAt: new Date(now + 3 * 86400_000),
      endAt: new Date(now + 3 * 86400_000 + 3 * 3600_000),
      registrationClosesAt: opts.registrationClosesAt ?? new Date(now + 2 * 86400_000),
      checkinOpensAt: opts.checkinOpensAt ?? new Date(now - 3600_000),
      checkinClosesAt: opts.checkinClosesAt ?? new Date(now + 4 * 86400_000),
      status: opts.status ?? "published",
      maxTicketsPerBooking: opts.maxPerBooking ?? 4,
      allowPassRequests: opts.allowPassRequests ?? false,
      ...(opts.eligible ? { eligibleCategories: opts.eligible } : {}),
    })
    .returning();
  const tiers = await db
    .insert(ticketTiers)
    .values(
      (opts.tiers ?? [{ name: "General", pricePaise: 50000, capacity: 10 }]).map((t, i) => ({
        ...t,
        eventId: event!.id,
        sortOrder: i,
      })),
    )
    .returning();
  created.events.push(event!.id);
  return { event: event!, tiers };
}

export async function tier(id: string) {
  const [t] = await db.select().from(ticketTiers).where(eq(ticketTiers.id, id));
  return t!;
}

export async function booking(id: string) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
  return b!;
}

export const key = () => randomUUID();

export async function cleanup() {
  const evIds = created.events.splice(0);
  const userIds = created.users.splice(0);
  if (evIds.length) {
    const bIds = (await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.eventId, evIds))).map((b) => b.id);
    await db.delete(auditLogs).where(inArray(auditLogs.eventId, evIds));
    await db.delete(checkIns).where(inArray(checkIns.eventId, evIds));
    await db.delete(refunds).where(inArray(refunds.eventId, evIds));
    if (bIds.length) {
      await db.delete(tickets).where(inArray(tickets.bookingId, bIds));
      await db.delete(payments).where(inArray(payments.bookingId, bIds));
      await db.delete(bookingItems).where(inArray(bookingItems.bookingId, bIds));
      await db.delete(bookings).where(inArray(bookings.id, bIds));
    }
    await db.delete(cancellationRequests).where(inArray(cancellationRequests.eventId, evIds));
    await db.delete(ticketTiers).where(inArray(ticketTiers.eventId, evIds));
    await db.delete(events).where(inArray(events.id, evIds));
  }
  if (userIds.length) {
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, userIds));
    await db.delete(notifications).where(inArray(notifications.userId, userIds));
    await db.execute(sql`delete from auth.users where id in ${userIds}`);
  }
}
