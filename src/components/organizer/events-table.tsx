import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import type { EventWithMetrics } from "@/lib/server/events";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatPaise } from "@/lib/format";

export function eventStatusBadge(e: { status: string; endAt: Date; visibility: string }) {
  if (e.status === "cancelled") return <StatusBadge tone="danger">Cancelled</StatusBadge>;
  if (e.status === "draft") return <StatusBadge tone="warning">Draft</StatusBadge>;
  if (e.endAt < new Date()) return <StatusBadge tone="neutral">Ended</StatusBadge>;
  return <StatusBadge tone="success">{e.visibility === "unlisted" ? "Live · unlisted" : "Live"}</StatusBadge>;
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EventsTable({ events, base = "/organizer/events", showOrganizer }: { events: (EventWithMetrics & { organizerName?: string })[]; base?: string; showOrganizer?: boolean }) {
  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="No events yet"
        description="Create your first event — save it as a draft or publish it right away."
        action={
          <Link href="/organizer/events/new" className={buttonVariants()}>
            Create event
          </Link>
        }
      />
    );
  }
  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-secondary/50 text-left">
            <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:font-medium [&>th]:text-muted-foreground">
              <th>Event</th>
              <th>Status</th>
              <th className="w-44">Seats</th>
              <th className="text-right">To verify</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Checked in</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-secondary/40 [&>td]:px-4 [&>td]:py-3.5">
                <td className="max-w-xs">
                  <Link href={`${base}/${e.id}`} className="font-medium hover:underline hover:underline-offset-4">
                    {e.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.startAt)}
                    {showOrganizer && e.organizerName ? ` · ${e.organizerName}` : ""}
                  </p>
                </td>
                <td>{eventStatusBadge(e)}</td>
                <td>
                  <div className="space-y-1.5">
                    <Meter value={e.allocated} max={e.capacity} />
                    <p className="text-xs text-muted-foreground tabular">
                      {e.allocated} / {e.capacity}
                    </p>
                  </div>
                </td>
                <td className="text-right tabular">
                  {e.pending > 0 ? (
                    <Link href={`/organizer/events/${e.id}/bookings`} className="font-semibold text-signal hover:underline">
                      {e.pending}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="text-right tabular">{e.revenuePaise ? formatPaise(e.revenuePaise) : "—"}</td>
                <td className="text-right tabular">{e.checkedIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
