import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EventsTable } from "@/components/organizer/events-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { eventsWithMetrics } from "@/lib/server/events";

export const metadata: Metadata = { title: "My events" };

export default async function OrganizerEvents() {
  const user = await requirePageUser(["organizer", "admin"]);
  const events = await eventsWithMetrics({ organizerId: user.id });
  return (
    <>
      <PageHeader
        eyebrow="Organizer"
        title="My events"
        description="Drafts, live and past events you manage."
        actions={
          <Link href="/organizer/events/new" className={buttonVariants()}>
            <CalendarPlus /> New event
          </Link>
        }
      />
      <div className="mt-8">
        <EventsTable events={events} />
      </div>
    </>
  );
}
