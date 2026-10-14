import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { bookings, profiles } from "@/db/schema";
import { createBooking } from "@/lib/server/bookings";
import { addModerator } from "@/lib/server/moderators";
import { createOrderForBooking, markPaymentFailed } from "@/lib/server/payments";
import { cleanup, key, makeEvent, makeUser } from "./helpers";

/**
 * Attacks a real user could attempt with the public key + their own session,
 * bypassing the UI entirely (PostgREST / Realtime surface), plus ID tampering
 * against server operations.
 */
const PASSWORD = "Sec-Test-Password-123";
const extraUsers: string[] = [];
const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const pub = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function sessionUser(): Promise<{ id: string; client: SupabaseClient }> {
  const admin = createClient(url(), process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const email = `sec+${randomUUID().slice(0, 8)}@uems.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Sec Tester" } });
  if (error) throw error;
  extraUsers.push(data.user!.id);
  const client = createClient(url(), pub(), { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id: data.user!.id, client };
}

let attacker: Awaited<ReturnType<typeof sessionUser>>;
let victimBookingId: string;
let eventId: string;
let draftId: string;

beforeAll(async () => {
  attacker = await sessionUser();
  const org = await makeUser("organizer");
  const victim = await makeUser();
  const { event, tiers } = await makeEvent(org);
  const draft = await makeEvent(org, { status: "draft" });
  eventId = event.id;
  draftId = draft.event.id;
  const b = await createBooking(victim, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
  victimBookingId = b.id;
  const mod = await makeUser();
  await addModerator(org, event.id, mod.email);
});

afterAll(async () => {
  if (extraUsers.length) await db.execute(sql`delete from auth.users where id in ${extraUsers}`);
  await cleanup();
});

describe("PostgREST surface with a real user session (RLS)", () => {
  it("cannot read other people's bookings, payments, tickets or moderator assignments", async () => {
    const { data: b } = await attacker.client.from("bookings").select("id").eq("id", victimBookingId);
    expect(b).toEqual([]);
    for (const table of ["payments", "tickets", "check_ins", "refunds", "event_moderators", "audit_logs", "webhook_events"]) {
      const { data } = await attacker.client.from(table).select("*").limit(5);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot see draft events or other profiles", async () => {
    const { data: drafts } = await attacker.client.from("events").select("id").eq("id", draftId);
    expect(drafts).toEqual([]);
    const { data: people } = await attacker.client.from("profiles").select("id");
    expect(people!.map((p) => p.id)).toEqual([attacker.id]);
  });

  it("cannot write anything: no self-promotion, no forged moderator rows, no fake check-ins", async () => {
    const promote = await attacker.client.from("profiles").update({ role: "admin" }).eq("id", attacker.id);
    expect(promote.error).not.toBeNull();
    const forgeMod = await attacker.client.from("event_moderators").insert({ event_id: eventId, user_id: attacker.id, added_by: attacker.id });
    expect(forgeMod.error).not.toBeNull();
    const forgeBooking = await attacker.client.from("bookings").update({ status: "approved" }).eq("id", victimBookingId);
    expect(forgeBooking.error).not.toBeNull();
    const [p] = await db.select().from(profiles).where(eq(profiles.id, attacker.id));
    expect(p!.role).toBe("participant");
    const [vb] = await db.select().from(bookings).where(eq(bookings.id, victimBookingId));
    expect(vb!.status).toBe("awaiting_payment");
  });
});

describe("ID tampering against server operations", () => {
  it("cannot create a payment order or mark payment failed for someone else's booking", async () => {
    const [me] = await db.select().from(profiles).where(eq(profiles.id, attacker.id));
    await expect(createOrderForBooking(me!, victimBookingId)).rejects.toThrow(/not found/i);
    const victimOrderOwner = await db.select({ userId: bookings.userId }).from(bookings).where(eq(bookings.id, victimBookingId));
    expect(victimOrderOwner[0]!.userId).not.toBe(attacker.id);
    // A forged order id for a booking they don't own is ignored.
    expect(await markPaymentFailed({ orderId: "order_does_not_exist", reason: "x", via: "checkout", userId: attacker.id })).toBe(false);
  });
});
