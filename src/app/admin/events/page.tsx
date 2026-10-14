import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, profiles } from "@/db/schema";
import { DownloadLink } from "@/components/common/download-link";
import { PageHeader } from "@/components/common/page-header";
import { EventsTable } from "@/components/organizer/events-table";
import { requirePageUser } from "@/lib/auth";
import { eventsWithMetrics } from "@/lib/server/events";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "All events" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "cancelled", label: "Cancelled" },
] as const;

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requirePageUser(["admin"]);
  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f.key === status)?.key ?? "all";
  const [list, owners] = await Promise.all([
    eventsWithMetrics(filter === "all" ? {} : { status: [filter] }),
    db.select({ id: events.id, name: profiles.fullName }).from(events).innerJoin(profiles, eq(profiles.id, events.organizerId)),
  ]);
  const ownerOf = new Map(owners.map((o) => [o.id, o.name]));
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="All events"
        description="Review any event, unpublish it, or cancel it outright. Open an event to manage it as its organizer would."
        actions={
          <DownloadLink href="/api/reports/events">Export CSV</DownloadLink>
        }
      />
      <div className="mt-8 mb-4 flex gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/events" : `/admin/events?status=${f.key}`}
            className={cn(
              "h-9 rounded-full border px-4 text-sm leading-9 font-medium",
              filter === f.key ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <EventsTable events={list.map((e) => ({ ...e, organizerName: ownerOf.get(e.id) }))} showOrganizer />
    </>
  );
}
