import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, events, payments, profiles, refunds } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/server/audit";
import { assertCanManageEvent } from "@/lib/server/bookings";
import { attendance } from "@/lib/server/checkin";
import { DomainError } from "@/lib/server/errors";
import { eventsWithMetrics } from "@/lib/server/events";
import { jsonError } from "@/lib/server/http";
import { auditTrail } from "@/lib/server/queries";

const TYPES = ["bookings", "attendance", "payments", "refunds", "events", "users", "audit"] as const;
type ReportType = (typeof TYPES)[number];
const ADMIN_ONLY: ReportType[] = ["payments", "refunds", "events", "users", "audit"];

const rupees = (paise: number) => (paise / 100).toFixed(2);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

/** CSV exports from authorised server-side queries. Organizers may export only their own event's bookings/attendance. */
export async function GET(request: Request, ctx: RouteContext<"/api/reports/[type]">) {
  try {
    const { type: rawType } = await ctx.params;
    const type = rawType as ReportType;
    if (!TYPES.includes(type)) throw new DomainError("Unknown report.", "not_found");
    const user = await requireUser(["organizer", "admin"]);
    const eventId = new URL(request.url).searchParams.get("eventId");
    if (eventId && !/^[0-9a-f-]{36}$/i.test(eventId)) throw new DomainError("Invalid event.");

    if (ADMIN_ONLY.includes(type) && user.role !== "admin") throw new DomainError("Administrators only.", "forbidden");
    if ((type === "bookings" || type === "attendance") && user.role !== "admin" && !eventId) {
      throw new DomainError("Choose an event to export.", "forbidden");
    }
    if (eventId) await assertCanManageEvent(db, user, eventId);
    if (type === "attendance" && !eventId) throw new DomainError("Choose an event to export.");

    let headers: string[] = [];
    let rows: unknown[][] = [];

    if (type === "bookings") {
      const data = await db
        .select({ b: bookings, eventTitle: events.title, name: profiles.fullName, email: profiles.email, category: profiles.category })
        .from(bookings)
        .innerJoin(events, eq(events.id, bookings.eventId))
        .innerJoin(profiles, eq(profiles.id, bookings.userId))
        .where(eventId ? eq(bookings.eventId, eventId) : undefined)
        .orderBy(desc(bookings.createdAt))
        .limit(20000);
      headers = ["Reference", "Event", "Name", "Email", "Category", "Type", "Booking status", "Payment status", "Refund status", "Tickets", "Amount (INR)", "Created at", "Decided at"];
      rows = data.map(({ b, ...r }) => [b.reference, r.eventTitle, r.name, r.email, r.category, b.kind, b.status, b.paymentStatus, b.refundStatus, b.quantity, rupees(b.amountPaise), iso(b.createdAt), iso(b.decidedAt)]);
    } else if (type === "attendance") {
      const data = await attendance(eventId!);
      headers = ["Ticket", "Attendee", "Tier", "Booking", "Booked by", "Email", "Ticket status", "Checked in at"];
      rows = data.map((r) => [r.ticketNumber, r.attendeeName, r.tierName, r.reference, r.buyer, r.buyerEmail, r.status, iso(r.checkedInAt)]);
    } else if (type === "payments") {
      const data = await db
        .select({ p: payments, reference: bookings.reference, eventTitle: events.title })
        .from(payments)
        .innerJoin(bookings, eq(bookings.id, payments.bookingId))
        .innerJoin(events, eq(events.id, bookings.eventId))
        .orderBy(desc(payments.createdAt))
        .limit(20000);
      headers = ["Order ID", "Payment ID", "Provider", "Booking", "Event", "Amount (INR)", "Status", "Confirmed via", "Flag", "Created at", "Paid at"];
      rows = data.map(({ p, ...r }) => [p.orderId, p.paymentId, p.provider, r.reference, r.eventTitle, rupees(p.amountPaise), p.status, p.confirmedVia, p.flag, iso(p.createdAt), iso(p.paidAt)]);
    } else if (type === "refunds") {
      const data = await db
        .select({ r: refunds, reference: bookings.reference, eventTitle: events.title, email: profiles.email })
        .from(refunds)
        .innerJoin(bookings, eq(bookings.id, refunds.bookingId))
        .innerJoin(events, eq(events.id, refunds.eventId))
        .innerJoin(profiles, eq(profiles.id, bookings.userId))
        .orderBy(desc(refunds.createdAt));
      headers = ["Booking", "Event", "Email", "Amount (INR)", "Status", "Provider refund ID", "Reason", "Attempts", "Created at", "Processed at"];
      rows = data.map(({ r, ...x }) => [x.reference, x.eventTitle, x.email, rupees(r.amountPaise), r.status, r.providerRefundId, r.reason, r.attempts, iso(r.createdAt), iso(r.processedAt)]);
    } else if (type === "events") {
      const data = await eventsWithMetrics();
      headers = ["Title", "Status", "Visibility", "Category", "Venue", "Starts at", "Capacity", "Seats allocated", "Tickets approved", "Pending verification", "Revenue (INR)", "Checked in"];
      rows = data.map((e) => [e.title, e.status, e.visibility, e.category, e.venue, iso(e.startAt), e.capacity, e.allocated, e.approved, e.pending, rupees(e.revenuePaise), e.checkedIn]);
    } else if (type === "users") {
      const data = await db.select().from(profiles).orderBy(desc(profiles.createdAt)).limit(20000);
      headers = ["Name", "Email", "Role", "Category", "Institution", "Active", "Joined"];
      rows = data.map((p) => [p.fullName, p.email, p.role, p.category, p.institution, p.isActive ? "yes" : "no", iso(p.createdAt)]);
    } else if (type === "audit") {
      const data = await auditTrail({ pageSize: 100, page: 1 });
      headers = ["Time", "Actor", "Role", "Action", "Entity", "Entity ID", "Event", "Details"];
      rows = data.rows.map((r) => [iso(r.log.createdAt), r.actorName ?? "system", r.actorRole, r.log.action, r.log.entityType, r.log.entityId, r.eventTitle, JSON.stringify(r.log.details)]);
    }

    await audit(db, {
      actorId: user.id,
      action: "report.exported",
      entityType: "report",
      entityId: type,
      eventId,
      details: { rows: rows.length },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="eventdeck-${type}-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
