import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, checkIns, eventModerators, profiles, tickets } from "@/db/schema";
import { createBooking, decideBooking } from "@/lib/server/bookings";
import { approveCancellation } from "@/lib/server/cancellations";
import { checkInTicket } from "@/lib/server/checkin";
import { DomainError } from "@/lib/server/errors";
import { addModerator, assertCanScanEvent, listModerators, MAX_MODERATORS_PER_EVENT, revokeModerator } from "@/lib/server/moderators";
import { searchEvents } from "@/lib/server/events";
import { qrPayload } from "@/lib/domain/tokens";
import { cleanup, key, makeClassifiedUser, makeEvent, makeUser } from "./helpers";

afterAll(cleanup);

/** An approved free booking with `qty` valid tickets on an event whose check-in window is open. */
async function ticketsFor(org: Awaited<ReturnType<typeof makeUser>>, qty: number) {
  const { event, tiers } = await makeEvent(org, { tiers: [{ name: "Entry", pricePaise: 0, capacity: 50 }], maxPerBooking: 4 });
  const buyer = await makeUser();
  const b = await createBooking(buyer, { eventId: event.id, lines: [{ tierId: tiers[0]!.id, quantity: qty }], attendeeNames: [], idempotencyKey: key() });
  await decideBooking(org, b.id, "approve");
  const list = await db.select().from(tickets).where(eq(tickets.bookingId, b.id));
  return { event, tickets: list };
}

describe("organizer assigns event-specific moderators", () => {
  it("adds four friends, lists them, and rejects duplicates, unknown emails and owners", async () => {
    const org = await makeUser("organizer");
    const { event } = await ticketsFor(org, 1);
    const friends = await Promise.all([1, 2, 3, 4].map(() => makeUser()));
    for (const f of friends) await addModerator(org, event.id, f.email.toUpperCase());

    const list = await listModerators(org, event.id);
    expect(list).toHaveLength(4);
    expect(list.every((m) => m.moderator.revokedAt === null)).toBe(true);

    await expect(addModerator(org, event.id, friends[0]!.email)).rejects.toThrow(/already a moderator/);
    await expect(addModerator(org, event.id, "nobody-here@example.com")).rejects.toThrow(/No EventDeck account/);
    await expect(addModerator(org, event.id, org.email)).rejects.toThrow(/organizer already/);
    await expect(addModerator(org, event.id, "not-an-email")).rejects.toThrow(/valid email/);

    // Each moderator is notified with a link to their scanner.
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.eventId, event.id), eq(auditLogs.action, "moderator.added")));
    expect(audit).toBeTruthy();
  });

  it("only the owning organizer or an admin can assign moderators", async () => {
    const org = await makeUser("organizer");
    const otherOrg = await makeUser("organizer");
    const participant = await makeUser();
    const admin = await makeUser("admin");
    const { event } = await ticketsFor(org, 1);
    const friend = await makeUser();

    await expect(addModerator(otherOrg, event.id, friend.email)).rejects.toThrow(/own events/);
    await expect(addModerator(participant, event.id, participant.email)).rejects.toBeInstanceOf(DomainError); // no self-assignment
    await expect(addModerator(friend, event.id, friend.email)).rejects.toBeInstanceOf(DomainError);
    await addModerator(admin, event.id, friend.email);
    expect(await listModerators(admin, event.id)).toHaveLength(1);
  });

  it(`caps active moderators at ${MAX_MODERATORS_PER_EVENT} per event`, async () => {
    const org = await makeUser("organizer");
    const { event } = await ticketsFor(org, 1);
    const people = await Promise.all(Array.from({ length: MAX_MODERATORS_PER_EVENT + 1 }, () => makeUser()));
    for (const p of people.slice(0, MAX_MODERATORS_PER_EVENT)) await addModerator(org, event.id, p.email);
    await expect(addModerator(org, event.id, people.at(-1)!.email)).rejects.toThrow(/up to/);
  });
});

describe("moderators scan tickets with event-scoped authority", () => {
  it("each of four moderators checks in attendees; scans are attributed to them", async () => {
    const org = await makeUser("organizer");
    const { event, tickets: list } = await ticketsFor(org, 4);
    const mods = await Promise.all([1, 2, 3, 4].map(() => makeUser()));
    for (const m of mods) await addModerator(org, event.id, m.email);

    for (const [i, m] of mods.entries()) {
      const r = await checkInTicket(m, event.id, qrPayload(list[i]!.qrToken), "qr");
      expect(r.status).toBe("checked_in");
    }
    const rows = await db.select().from(checkIns).where(eq(checkIns.eventId, event.id));
    expect(new Set(rows.map((r) => r.scannedBy))).toEqual(new Set(mods.map((m) => m.id)));
  });

  it("two moderators scanning the same ticket simultaneously admit it exactly once", async () => {
    const org = await makeUser("organizer");
    const { event, tickets: list } = await ticketsFor(org, 1);
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    await addModerator(org, event.id, a.email);
    await addModerator(org, event.id, b.email);
    const code = qrPayload(list[0]!.qrToken);
    const results = await Promise.all([
      checkInTicket(a, event.id, code, "qr"),
      checkInTicket(b, event.id, code, "qr"),
      checkInTicket(a, event.id, code, "qr"),
      checkInTicket(b, event.id, list[0]!.ticketNumber, "manual"),
    ]);
    expect(results.filter((r) => r.status === "checked_in")).toHaveLength(1);
    expect(results.filter((r) => r.status === "already_used")).toHaveLength(3);
    expect(await db.select().from(checkIns).where(eq(checkIns.ticketId, list[0]!.id))).toHaveLength(1);
  });

  it("moderators cannot scan other events, and unassigned users cannot scan at all", async () => {
    const org = await makeUser("organizer");
    const mine = await ticketsFor(org, 1);
    const other = await ticketsFor(org, 1);
    const mod = await makeUser();
    const stranger = await makeUser();
    await addModerator(org, mine.event.id, mod.email);

    // Their own event's scanner refuses a ticket from another event…
    const cross = await checkInTicket(mod, mine.event.id, qrPayload(other.tickets[0]!.qrToken), "qr");
    expect(cross).toMatchObject({ status: "invalid", message: "This ticket is for a different event." });
    // …and they have no authority on the other event at all.
    await expect(checkInTicket(mod, other.event.id, qrPayload(other.tickets[0]!.qrToken), "qr")).rejects.toThrow(/not a check-in moderator/);
    await expect(checkInTicket(stranger, mine.event.id, qrPayload(mine.tickets[0]!.qrToken), "qr")).rejects.toThrow(/not a check-in moderator/);
    expect(await db.select().from(checkIns).where(eq(checkIns.eventId, other.event.id))).toHaveLength(0);
  });

  it("moderators get no organizer powers (decisions, assignments, management)", async () => {
    const org = await makeUser("organizer");
    const { event } = await ticketsFor(org, 1);
    const mod = await makeUser();
    await addModerator(org, event.id, mod.email);
    const buyer = await makeUser();
    const pending = await createBooking(buyer, { eventId: event.id, lines: [{ tierId: (await db.query.ticketTiers.findFirst({ where: (t, { eq: e }) => e(t.eventId, event.id) }))!.id, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });
    await expect(decideBooking(mod, pending.id, "approve")).rejects.toThrow(/own events/);
    await expect(addModerator(mod, event.id, buyer.email)).rejects.toThrow(/own events/);
    await expect(listModerators(mod, event.id)).rejects.toThrow(/own events/);
    const [p] = await db.select().from(profiles).where(eq(profiles.id, mod.id));
    expect(p!.role).toBe("participant");
  });

  it("revoked or deactivated moderators are refused on their next scan", async () => {
    const org = await makeUser("organizer");
    const { event, tickets: list } = await ticketsFor(org, 2);
    const mod = await makeUser();
    const row = await addModerator(org, event.id, mod.email);
    expect((await checkInTicket(mod, event.id, qrPayload(list[0]!.qrToken), "qr")).status).toBe("checked_in");

    await revokeModerator(org, event.id, row.id);
    await expect(checkInTicket(mod, event.id, qrPayload(list[1]!.qrToken), "qr")).rejects.toThrow(/not a check-in moderator/);
    await expect(revokeModerator(org, event.id, row.id)).rejects.toThrow(/already removed/);

    // Re-adding after revocation works (history is kept as a separate row).
    await addModerator(org, event.id, mod.email);
    expect(await db.select().from(eventModerators).where(eq(eventModerators.eventId, event.id))).toHaveLength(2);
    await expect(assertCanScanEvent(db, { ...mod, isActive: false }, event.id)).rejects.toThrow(/deactivated/);
  });

  it("tampered, unknown and cancelled-event tickets are rejected for moderators", async () => {
    const org = await makeUser("organizer");
    const admin = await makeUser("admin");
    const { event, tickets: list } = await ticketsFor(org, 1);
    const mod = await makeUser();
    await addModerator(org, event.id, mod.email);
    const t = list[0]!.qrToken;
    const tampered = t.slice(0, -1) + (t.endsWith("A") ? "B" : "A");
    expect((await checkInTicket(mod, event.id, qrPayload(tampered), "qr")).status).toBe("invalid");
    expect((await checkInTicket(mod, event.id, "EVD1:" + "x".repeat(32), "qr")).status).toBe("invalid");
    expect((await checkInTicket(mod, event.id, '{"ticket":"valid","status":"approved"}', "qr")).status).toBe("invalid");

    await approveCancellation(admin, { eventId: event.id, reason: "Cancelled for moderator test" });
    const r = await checkInTicket(mod, event.id, qrPayload(t), "qr");
    expect(r.status).toBe("invalid");
  });
});

describe("multi-campus and inter-college registration rules (server-side)", () => {
  const book = (u: Parameters<typeof createBooking>[0], eventId: string, tierId: string) =>
    createBooking(u, { eventId, lines: [{ tierId, quantity: 1 }], attendeeNames: [], idempotencyKey: key() });

  it("campus-only, inter-campus and approved-college events admit exactly the configured audience", async () => {
    const org = await makeUser("organizer");
    const ktr = await makeClassifiedUser({ institutionType: "SRM", campus: "KTR", affiliation: "STUDENT" });
    const ram = await makeClassifiedUser({ institutionType: "SRM", campus: "RAMAPURAM", affiliation: "STUDENT" });
    const vad = await makeClassifiedUser({ institutionType: "SRM", campus: "VADAPALANI", affiliation: "STUDENT" });
    const vit = await makeClassifiedUser({ institutionType: "EXTERNAL_INSTITUTION", affiliation: "STUDENT", institutionName: "VIT", city: "Vellore" });
    const anna = await makeClassifiedUser({ institutionType: "EXTERNAL_INSTITUTION", affiliation: "STUDENT", institutionName: "Anna University", city: "Chennai" });
    const loyola = await makeClassifiedUser({ institutionType: "EXTERNAL_INSTITUTION", affiliation: "STUDENT", institutionName: "Loyola College", city: "Chennai" });
    const guest = await makeClassifiedUser({ institutionType: "GUEST", affiliation: "GUEST" });

    const freeTier = [{ name: "Entry", pricePaise: 0, capacity: 50 }];
    const campusOnly = await makeEvent(org, { tiers: freeTier, audience: { types: ["SRM"], campuses: ["KTR"] } });
    const interCampus = await makeEvent(org, { tiers: freeTier, audience: { types: ["SRM"], campuses: ["KTR", "RAMAPURAM"] } });
    const interCollege = await makeEvent(org, { tiers: freeTier, audience: { types: ["SRM", "EXTERNAL_INSTITUTION"], institutions: ["VIT", "Anna University"] } });
    const openEvent = await makeEvent(org, { tiers: freeTier });

    const tier = (e: typeof campusOnly) => e.tiers[0]!.id;
    await expect(book(ktr, campusOnly.event.id, tier(campusOnly))).resolves.toBeTruthy();
    await expect(book(ram, campusOnly.event.id, tier(campusOnly))).rejects.toThrow(/limited to SRM KTR/);
    await expect(book(vit, campusOnly.event.id, tier(campusOnly))).rejects.toThrow(/isn't open to students from other colleges/);
    await expect(book(guest, campusOnly.event.id, tier(campusOnly))).rejects.toThrow(/isn't open to guests/);

    await expect(book(ram, interCampus.event.id, tier(interCampus))).resolves.toBeTruthy();
    await expect(book(vad, interCampus.event.id, tier(interCampus))).rejects.toThrow(/limited to SRM KTR & Ramapuram/);

    await expect(book(vit, interCollege.event.id, tier(interCollege))).resolves.toBeTruthy();
    await expect(book(anna, interCollege.event.id, tier(interCollege))).resolves.toBeTruthy();
    await expect(book(vad, interCollege.event.id, tier(interCollege))).resolves.toBeTruthy();
    await expect(book(loyola, interCollege.event.id, tier(interCollege))).rejects.toThrow(/approved institutions/);
    await expect(book(guest, interCollege.event.id, tier(interCollege))).rejects.toThrow(/guests/);

    for (const u of [ktr, vad, loyola, guest]) await expect(book(u, openEvent.event.id, tier(openEvent))).resolves.toBeTruthy();

    // Discovery filters reflect the same rules.
    const srmOnly = await searchEvents({ audience: "srm", pageSize: 48 });
    const ids = srmOnly.items.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([campusOnly.event.id, interCampus.event.id]));
    expect(ids).not.toContain(interCollege.event.id);
    expect(ids).not.toContain(openEvent.event.id);
    const ic = (await searchEvents({ audience: "intercollege", pageSize: 48 })).items.map((e) => e.id);
    expect(ic).toContain(interCollege.event.id);
    expect(ic).not.toContain(campusOnly.event.id);
  });
});
