import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, CheckCircle2, IndianRupee, ScanLine, Ticket } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { StatusBadge } from "@/components/common/status-badge";
import { EventsTable } from "@/components/organizer/events-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { formatInr, relativeTime } from "@/lib/format";
import { eventsWithMetrics } from "@/lib/server/events";
import { organizerQueue } from "@/lib/server/queries";

export const metadata: Metadata = { title: "Organizer" };

export default async function OrganizerHome() {
  const user = await requirePageUser(["organizer", "admin"]);
  const [events, queue] = await Promise.all([eventsWithMetrics({ organizerId: user.id }), organizerQueue(user.id)]);
  const now = new Date();
  const upcoming = events.filter((e) => e.status !== "cancelled" && e.endAt >= now);
  const totals = events.reduce(
    (a, e) => ({ approved: a.approved + e.approved, revenue: a.revenue + e.revenuePaise, pending: a.pending + e.pending, checkedIn: a.checkedIn + e.checkedIn }),
    { approved: 0, revenue: 0, pending: 0, checkedIn: 0 },
  );
  const live = upcoming.find((e) => e.status === "published" && e.checkinOpensAt <= now && e.checkinClosesAt >= now);

  return (
    <>
      <PageHeader
        eyebrow="Organizer"
        title={`Good to see you, ${user.fullName.split(" ")[0]}`}
        description="Your events, verification queue and attendance at a glance."
        actions={
          <Link href="/organizer/events/new" className={buttonVariants()}>
            <CalendarPlus /> New event
          </Link>
        }
      />

      {live && (
        <Link
          href={`/organizer/events/${live.id}/scan`}
          className="mt-8 flex items-center gap-4 rounded-xl bg-foreground px-5 py-4 text-background transition-opacity hover:opacity-95"
        >
          <span className="relative grid size-10 place-items-center rounded-full bg-signal">
            <ScanLine className="size-5" />
            <span className="absolute inset-0 animate-ping rounded-full bg-signal/50" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Check-in is open · {live.title}</p>
            <p className="text-sm text-background/60">{live.checkedIn} checked in so far. Open the scanner on your phone.</p>
          </div>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming events" value={upcoming.length} icon={CalendarPlus} hint={`${events.length} total`} />
        <Stat label="Tickets approved" value={totals.approved} icon={Ticket} />
        <Stat label="Revenue (test)" value={formatInr(totals.revenue)} icon={IndianRupee} />
        <Stat label="To verify" value={totals.pending} icon={CheckCircle2} emphasis={totals.pending > 0} hint={totals.pending ? "Waiting on you" : "All caught up"} />
      </div>

      {queue.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Verification queue" description="Oldest first. Tickets stay invalid until you approve." />
          <ul className="surface divide-y">
            {queue.map((q) => (
              <li key={q.booking.id}>
                <Link href={`/organizer/events/${q.eventId}/bookings`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {q.buyer} <span className="font-normal text-muted-foreground">· {q.booking.quantity} ticket(s)</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{q.eventTitle}</p>
                  </div>
                  <StatusBadge tone={q.booking.kind === "complimentary" ? "info" : q.booking.kind === "paid" ? "success" : "neutral"}>
                    {q.booking.kind === "complimentary" ? "Pass request" : q.booking.kind === "paid" ? "Paid" : "Free"}
                  </StatusBadge>
                  <span className="hidden text-xs text-muted-foreground sm:block">{relativeTime(q.booking.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <SectionHeading
          title="Your events"
          action={
            <Link href="/organizer/events" className="text-sm font-medium link-underline">
              View all
            </Link>
          }
        />
        <EventsTable events={events.slice(0, 6)} />
      </section>
    </>
  );
}
