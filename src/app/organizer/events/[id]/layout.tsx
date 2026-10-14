import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SubNav } from "@/components/layout/dashboard-shell";
import { EventActions } from "@/components/organizer/event-actions";
import { eventStatusBadge } from "@/components/organizer/events-table";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { formatRange } from "@/lib/format";
import { getManagedEvent } from "@/lib/server/events";
import { bookingCounts, eventCancellationRequests } from "@/lib/server/queries";

export async function generateMetadata({ params }: LayoutProps<"/organizer/events/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Event" };
  const user = await getCurrentUser();
  const [row] = await db.select({ title: events.title, organizerId: events.organizerId }).from(events).where(eq(events.id, id)).limit(1);
  const allowed = row && user && (user.role === "admin" || row.organizerId === user.id);
  return { title: allowed ? `Manage · ${row.title}` : "Event" };
}

export default async function ManagedEventLayout({ children, params }: LayoutProps<"/organizer/events/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const { event } = data;
  const [counts, requests] = await Promise.all([bookingCounts(id), eventCancellationRequests(id)]);
  const pendingCancel = requests.find((r) => r.status === "pending");
  const base = `/organizer/events/${id}`;

  return (
    <>
      <Link href={user.role === "admin" && event.organizerId !== user.id ? "/admin/events" : "/organizer/events"} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {user.role === "admin" && event.organizerId !== user.id ? "All events" : "My events"}
      </Link>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {eventStatusBadge(event)}
            {pendingCancel && <span className="text-xs font-medium text-destructive">Cancellation requested</span>}
          </div>
          <h1 className="font-display mt-3 text-[2.25rem] leading-[1.02] text-balance sm:text-[2.75rem]">{event.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatRange(event.startAt, event.endAt)} · {event.venue}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/events/${event.slug}`} className={buttonVariants({ variant: "ghost", size: "sm" })} target="_blank">
            <ExternalLink /> Public page
          </Link>
          <EventActions
            eventId={event.id}
            status={event.status}
            hasPendingCancellation={Boolean(pendingCancel)}
            isAdmin={user.role === "admin"}
          />
        </div>
      </div>
      <SubNav
        links={[
          { href: base, label: "Overview" },
          { href: `${base}/bookings`, label: "Bookings", badge: counts.review + counts.passes },
          { href: `${base}/scan`, label: "Scanner" },
          { href: `${base}/attendance`, label: "Attendance" },
          { href: `${base}/team`, label: "Team" },
          { href: `${base}/edit`, label: "Edit" },
          { href: `${base}/activity`, label: "Activity" },
        ]}
      />
      <div className="mt-8">{children}</div>
    </>
  );
}
