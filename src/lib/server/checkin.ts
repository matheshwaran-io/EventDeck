import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, checkIns, profiles, ticketTiers, tickets, type Profile } from "@/db/schema";
import { parseScan } from "@/lib/domain/tokens";
import { audit } from "./audit";
import { assertCanManageEvent } from "./bookings";

export type ScanResult =
  | { status: "checked_in"; ticket: ScanTicket; scannedAt: string }
  | { status: "already_used"; ticket: ScanTicket; scannedAt: string; scannedBy: string }
  | { status: "outside_window"; ticket: ScanTicket; message: string }
  | { status: "invalid"; message: string; ticket?: ScanTicket };

export type ScanTicket = { ticketNumber: string; attendeeName: string; tierName: string; bookingReference: string };

/** Validate a scan server-side and record the check-in exactly once. */
export async function checkInTicket(actor: Profile, eventId: string, raw: string, method: "qr" | "manual"): Promise<ScanResult> {
  const event = await assertCanManageEvent(db, actor, eventId);
  const parsed = parseScan(raw);
  if (!parsed) return { status: "invalid", message: "That code isn't a ticket from this system." };

  const [row] = await db
    .select({ ticket: tickets, tierName: ticketTiers.name, booking: bookings })
    .from(tickets)
    .innerJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .innerJoin(bookings, eq(bookings.id, tickets.bookingId))
    .where(parsed.kind === "token" ? eq(tickets.qrToken, parsed.value) : eq(tickets.ticketNumber, parsed.value))
    .limit(1);

  if (!row) return { status: "invalid", message: "Ticket not found." };
  const info: ScanTicket = {
    ticketNumber: row.ticket.ticketNumber,
    attendeeName: row.ticket.attendeeName,
    tierName: row.tierName,
    bookingReference: row.booking.reference,
  };
  if (row.ticket.eventId !== eventId) return { status: "invalid", message: "This ticket is for a different event." };

  const reject = async (message: string): Promise<ScanResult> => {
    await audit(db, {
      actorId: actor.id,
      action: "checkin.rejected",
      entityType: "ticket",
      entityId: row.ticket.id,
      eventId,
      details: { ticketNumber: row.ticket.ticketNumber, reason: message, method },
    });
    return { status: "invalid", message, ticket: info };
  };

  if (event.status === "cancelled") return reject("This event has been cancelled — all tickets are void.");
  if (row.ticket.status !== "valid") return reject(`Ticket invalidated${row.ticket.invalidationReason ? `: ${row.ticket.invalidationReason}` : ""}.`);
  if (row.booking.status !== "approved") return reject("This booking isn't approved.");
  if (row.booking.paymentStatus !== "paid" && row.booking.paymentStatus !== "not_required") return reject("Payment not verified.");

  const now = new Date();
  if (now < event.checkinOpensAt || now > event.checkinClosesAt) {
    return {
      status: "outside_window",
      ticket: info,
      message: now < event.checkinOpensAt ? "Check-in hasn't opened yet." : "Check-in has closed for this event.",
    };
  }

  // Unique(ticket_id) makes the first scan win, even across devices.
  const [inserted] = await db
    .insert(checkIns)
    .values({ ticketId: row.ticket.id, eventId, scannedBy: actor.id, method })
    .onConflictDoNothing({ target: checkIns.ticketId })
    .returning();

  if (inserted) {
    await audit(db, {
      actorId: actor.id,
      action: "checkin.accepted",
      entityType: "ticket",
      entityId: row.ticket.id,
      eventId,
      details: { ticketNumber: row.ticket.ticketNumber, method },
    });
    return { status: "checked_in", ticket: info, scannedAt: inserted.scannedAt.toISOString() };
  }

  const [prior] = await db
    .select({ scannedAt: checkIns.scannedAt, by: profiles.fullName })
    .from(checkIns)
    .innerJoin(profiles, eq(profiles.id, checkIns.scannedBy))
    .where(eq(checkIns.ticketId, row.ticket.id));
  await audit(db, {
    actorId: actor.id,
    action: "checkin.duplicate",
    entityType: "ticket",
    entityId: row.ticket.id,
    eventId,
    details: { ticketNumber: row.ticket.ticketNumber, method },
  });
  return { status: "already_used", ticket: info, scannedAt: prior!.scannedAt.toISOString(), scannedBy: prior!.by };
}

export async function attendance(eventId: string) {
  return db
    .select({
      ticketNumber: tickets.ticketNumber,
      attendeeName: tickets.attendeeName,
      tierName: ticketTiers.name,
      status: tickets.status,
      reference: bookings.reference,
      buyer: profiles.fullName,
      buyerEmail: profiles.email,
      checkedInAt: checkIns.scannedAt,
    })
    .from(tickets)
    .innerJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .innerJoin(bookings, eq(bookings.id, tickets.bookingId))
    .innerJoin(profiles, eq(profiles.id, bookings.userId))
    .leftJoin(checkIns, eq(checkIns.ticketId, tickets.id))
    .where(and(eq(tickets.eventId, eventId)))
    .orderBy(tickets.attendeeName);
}

