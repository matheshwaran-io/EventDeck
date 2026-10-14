import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, events } from "@/db/schema";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/lib/auth";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(["organizer", "admin"], "/organizer");
  const [{ n }] = await db
    .select({ n: count() })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(events.organizerId, user.id), eq(bookings.status, "pending_verification")));
  return (
    <DashboardShell
      title="Organizer"
      links={[
        { href: "/organizer", label: "Overview", icon: "dashboard", exact: true, badge: n },
        { href: "/organizer/events", label: "My events", icon: "events" },
        { href: "/organizer/events/new", label: "New event", icon: "newEvent" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
