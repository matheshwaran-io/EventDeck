import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Hourglass, IndianRupee, ScanLine, Users } from "lucide-react";
import { SectionHeading } from "@/components/common/page-header";
import { Stat } from "@/components/common/stat";
import { StatusBadge } from "@/components/common/status-badge";
import { CopyLink } from "@/components/organizer/copy-link";
import { Meter } from "@/components/organizer/events-table";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatInr, formatPaise, relativeTime } from "@/lib/format";
import { getManagedEvent } from "@/lib/server/events";
import { auditTrail, eventCancellationRequests } from "@/lib/server/queries";
import { describeAction } from "@/components/organizer/activity-list";
import { getAppUrl } from "@/lib/constants";

export default async function ManagedEventOverview({ params }: PageProps<"/organizer/events/[id]">) {
  const { id } = await params;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const { event, tiers, metrics } = data;
  const [requests, activity] = await Promise.all([eventCancellationRequests(id), auditTrail({ eventId: id, pageSize: 6 })]);
  const capacity = tiers.reduce((a, t) => a + t.capacity, 0);
  const allocated = tiers.reduce((a, t) => a + t.allocated, 0);
  const now = new Date();
  const checkinOpen = event.status === "published" && event.checkinOpensAt <= now && event.checkinClosesAt >= now;
  const appUrl = getAppUrl();

  return (
    <div className="space-y-10">
      {event.adminNote && event.status === "draft" && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-semibold">Note from an administrator</p>
          <p className="mt-1 text-foreground/80">{event.adminNote}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Seats taken" value={`${allocated}/${capacity}`} icon={Users} hint={`${Math.max(0, capacity - allocated)} remaining`} />
        <Stat label="Approved tickets" value={metrics.approved} icon={CheckCircle2} />
        <Stat label="To verify" value={metrics.pending} icon={ClipboardCheck} emphasis={metrics.pending > 0} hint={metrics.passes ? `${metrics.passes} pass request(s)` : undefined} />
        <Stat label="Awaiting payment" value={metrics.awaiting} icon={Hourglass} hint="Held for 10 min" />
        <Stat label="Revenue (test)" value={formatInr(metrics.revenuePaise)} icon={IndianRupee} hint={`${metrics.checkedIn} checked in`} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section>
          <SectionHeading title="Inventory by tier" description="Includes seats held by bookings awaiting payment." />
          <ul className="surface divide-y">
            {tiers.map((t) => (
              <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPaise(t.pricePaise)}</p>
                </div>
                <p className="text-sm tabular">
                  <span className="font-semibold">{t.allocated}</span>
                  <span className="text-muted-foreground"> / {t.capacity}</span>
                </p>
                <div className="col-span-2">
                  <Meter value={t.allocated} max={t.capacity} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-8">
          <section className="surface space-y-4 p-5">
            <h2 className="text-sm font-semibold">Check-in</h2>
            <p className="text-sm text-muted-foreground">
              Window: {formatDateTime(event.checkinOpensAt)} – {formatDateTime(event.checkinClosesAt)}
            </p>
            <div className="flex items-center gap-2">
              <StatusBadge tone={checkinOpen ? "success" : "neutral"}>{checkinOpen ? "Open now" : event.checkinOpensAt > now ? "Not open yet" : "Closed"}</StatusBadge>
              <span className="text-sm text-muted-foreground">{metrics.checkedIn} scanned in</span>
            </div>
            <Link href={`/organizer/events/${id}/scan`} className={buttonVariants({ className: "w-full" })}>
              <ScanLine /> Open scanner
            </Link>
          </section>

          <section className="surface space-y-3 p-5">
            <h2 className="text-sm font-semibold">Share</h2>
            <p className="text-sm text-muted-foreground">
              {event.visibility === "unlisted" ? "Unlisted — only people with this link can find it." : "Public — listed in search and on the home page."}
            </p>
            <CopyLink url={`${appUrl}/events/${event.slug}`} />
          </section>

          {requests.length > 0 && (
            <section className="surface p-5">
              <h2 className="text-sm font-semibold">Cancellation requests</h2>
              <ul className="mt-3 space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge tone={r.status === "pending" ? "warning" : r.status === "approved" ? "danger" : "neutral"}>
                        {r.status === "pending" ? "Awaiting admin" : r.status === "approved" ? "Approved" : "Declined"}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-muted-foreground">{r.reason}</p>
                    {r.reviewNote && <p className="mt-1 text-xs">Admin: {r.reviewNote}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section>
        <SectionHeading
          title="Recent activity"
          action={
            <Link href={`/organizer/events/${id}/activity`} className="text-sm font-medium link-underline">
              Full log
            </Link>
          }
        />
        <ul className="surface divide-y text-sm">
          {activity.rows.length === 0 && <li className="px-4 py-6 text-center text-muted-foreground">No activity yet.</li>}
          {activity.rows.map((r) => (
            <li key={r.log.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0 truncate">
                <span className="font-medium">{r.actorName ?? "System"}</span> <span className="text-muted-foreground">{describeAction(r.log.action)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(r.log.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
