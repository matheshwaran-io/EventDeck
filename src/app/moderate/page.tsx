import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatRange } from "@/lib/format";
import { moderatedEvents } from "@/lib/server/moderators";

export const metadata: Metadata = { title: "Check-in" };

export default async function ModeratePage() {
  const user = await requirePageUser();
  const rows = await moderatedEvents(user.id);
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Moderator" title="Check-in duty" description="Events where an organizer asked you to scan tickets at the door." />
      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={ScanLine}
          title="No check-in assignments"
          description="When an organizer adds you as a moderator, the event appears here."
        />
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map(({ event, checkedIn, myScans }) => {
            const open = event.status === "published" && event.checkinOpensAt <= now && event.checkinClosesAt >= now;
            return (
              <li key={event.id}>
                <Link
                  href={`/moderate/${event.id}`}
                  className="surface flex flex-col gap-3 p-4 transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={event.status === "cancelled" ? "danger" : open ? "success" : "neutral"}>
                        {event.status === "cancelled" ? "Cancelled" : open ? "Check-in open" : event.checkinOpensAt > now ? "Opens later" : "Closed"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 font-semibold">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatRange(event.startAt, event.endAt)} · {event.venue}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Window {formatDateTime(event.checkinOpensAt)} – {formatDateTime(event.checkinClosesAt)} · {checkedIn} in · {myScans} by you
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    Open scanner <ArrowRight className="size-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
