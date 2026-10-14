import { loadTestEnv } from "../tests/env-guard";
import postgres from "postgres";

/**
 * Removes only what the E2E suite created (events titled "E2E …", users
 * e2e+…@eventdeck.test) so demo data stays presentable. Seats held by removed
 * bookings on seeded events are released first so inventory stays consistent.
 */
export default async function globalTeardown() {
  // Deletes only E2E-created rows, and only in the guarded Supabase TEST project.
  loadTestEnv("e2e-teardown");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    await sql.begin(async (tx) => {
      const users = await tx`select id from profiles where email like 'e2e+%@eventdeck.test'`;
      const events = await tx`select id from events where title like 'E2E %' or slug like 'e2e-%'`;
      const userIds = users.map((u) => u.id as string);
      const eventIds = events.map((e) => e.id as string);
      const bookings = await tx`
        select id, status from bookings
        where user_id = any(${userIds}::uuid[]) or event_id = any(${eventIds}::uuid[])`;
      const bookingIds = bookings.map((b) => b.id as string);
      const holding = bookings.filter((b) => ["awaiting_payment", "pending_verification", "approved"].includes(b.status as string)).map((b) => b.id as string);

      await tx`
        update ticket_tiers t set allocated = greatest(t.allocated - x.q, 0)
        from (select tier_id, sum(quantity)::int q from booking_items where booking_id = any(${holding}::uuid[]) group by tier_id) x
        where t.id = x.tier_id`;
      await tx`delete from event_moderators where event_id = any(${eventIds}::uuid[]) or user_id = any(${userIds}::uuid[]) or added_by = any(${userIds}::uuid[])`;
      await tx`delete from audit_logs where event_id = any(${eventIds}::uuid[]) or actor_id = any(${userIds}::uuid[]) or entity_id = any(${bookingIds}::text[])`;
      await tx`delete from check_ins where event_id = any(${eventIds}::uuid[]) or ticket_id in (select id from tickets where booking_id = any(${bookingIds}::uuid[]))`;
      await tx`delete from refunds where booking_id = any(${bookingIds}::uuid[]) or event_id = any(${eventIds}::uuid[])`;
      await tx`delete from tickets where booking_id = any(${bookingIds}::uuid[])`;
      await tx`delete from payments where booking_id = any(${bookingIds}::uuid[])`;
      await tx`delete from booking_items where booking_id = any(${bookingIds}::uuid[])`;
      await tx`delete from bookings where id = any(${bookingIds}::uuid[])`;
      await tx`delete from cancellation_requests where event_id = any(${eventIds}::uuid[])`;
      await tx`delete from notifications where user_id = any(${userIds}::uuid[]) or href like any(${eventIds.map((id) => `%${id}%`)}::text[])`;
      await tx`delete from ticket_tiers where event_id = any(${eventIds}::uuid[])`;
      await tx`delete from events where id = any(${eventIds}::uuid[])`;
      await tx`delete from organizer_applications where user_id = any(${userIds}::uuid[])`;
      await tx`delete from auth.users where id = any(${userIds}::uuid[])`;
    });
  } finally {
    await sql.end();
  }
}
