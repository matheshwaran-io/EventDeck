import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CheckCircle2, X } from "lucide-react";
import { approveCancellationAction, rejectCancellationAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { cancellationQueue } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cancellations" };

export default async function CancellationsPage({ searchParams }: PageProps<"/admin/cancellations">) {
  await requirePageUser(["admin"]);
  const { status: s } = await searchParams;
  const status = s === "approved" || s === "rejected" ? s : "pending";
  const rows = await cancellationQueue(status);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Cancellation requests"
        description="Approving cancels the event, invalidates every ticket, notifies attendees and queues refunds for paid bookings."
      />
      <nav className="mt-8 flex gap-1 border-b">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <Link
            key={t}
            href={t === "pending" ? "/admin/cancellations" : `/admin/cancellations?status=${t}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium capitalize",
              status === t ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState className="mt-6" icon={CheckCircle2} title={status === "pending" ? "No pending requests" : `No ${status} requests`} />
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.req.id} className="surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <Link href={`/organizer/events/${r.req.eventId}`} className="font-semibold hover:underline">
                    {r.eventTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(r.eventStart)} · requested by {r.requester} {relativeTime(r.req.createdAt)}
                  </p>
                  <blockquote className="mt-3 border-l-2 border-signal pl-3 text-sm">{r.req.reason}</blockquote>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <StatusBadge tone="neutral">{r.bookings} live booking(s)</StatusBadge>
                    <StatusBadge tone={r.paidBookings ? "warning" : "neutral"}>{r.paidBookings} paid → refunds</StatusBadge>
                  </div>
                  {r.req.reviewedAt && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {r.req.status === "approved" ? "Approved" : "Declined"} by {r.reviewerName} on {formatDateTime(r.req.reviewedAt)}
                      {r.req.reviewNote ? ` — ${r.req.reviewNote}` : ""}
                    </p>
                  )}
                </div>
                {status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <ConfirmAction
                      action={rejectCancellationAction.bind(null, r.req.id)}
                      variant="outline"
                      icon={<X />}
                      label="Decline"
                      title="Decline cancellation"
                      description="The event stays live and the organizer is notified."
                      note={{ label: "Note to organizer", required: true, minLength: 5 }}
                    />
                    <ConfirmAction
                      action={approveCancellationAction.bind(null, r.req.id)}
                      variant="destructive"
                      icon={<Ban />}
                      label="Approve & cancel event"
                      title="Cancel this event?"
                      confirmLabel="Cancel event"
                      description={`This invalidates all tickets for ${r.bookings} booking(s), notifies attendees, and queues ${r.paidBookings} refund(s). It can't be undone.`}
                      note={{ label: "Internal note" }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
