import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, events, ticketTiers, tickets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ticketsShouldBeValid } from "@/lib/domain/transitions";
import { renderTicketsPdf } from "@/lib/server/pdf";
import { readTicketPdf, writeTicketPdf } from "@/lib/server/storage";

/** Access-controlled ticket PDF. Only produced while every validity gate passes. */
export async function GET(_request: Request, ctx: RouteContext<"/api/tickets/[bookingId]/pdf">) {
  const { bookingId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to download tickets." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [row] = await db
    .select({ booking: bookings, event: events })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const allowed = row && (row.booking.userId === user.id || user.role === "admin");
  if (!row || !allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!ticketsShouldBeValid({ bookingStatus: row.booking.status, paymentStatus: row.booking.paymentStatus, eventStatus: row.event.status })) {
    return NextResponse.json({ error: "Tickets are not valid for download." }, { status: 409 });
  }

  const list = await db
    .select({ ticket: tickets, tierName: ticketTiers.name, tierPricePaise: ticketTiers.pricePaise })
    .from(tickets)
    .innerJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(and(eq(tickets.bookingId, bookingId), eq(tickets.status, "valid")))
    .orderBy(asc(tickets.seq));
  if (!list.length) return NextResponse.json({ error: "No valid tickets." }, { status: 409 });

  // Cache keyed by the exact set of valid tickets, in the private bucket.
  const path = `${row.booking.userId}/${bookingId}-${list.length}.pdf`;
  let bytes: Uint8Array | null = await readTicketPdf(path);
  if (!bytes) {
    bytes = await renderTicketsPdf(
      row.event,
      row.booking,
      list.map((l) => ({ ...l.ticket, tierName: l.tierName, tierPricePaise: l.tierPricePaise })),
    );
    await writeTicketPdf(path, bytes);
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.booking.reference}-tickets.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
