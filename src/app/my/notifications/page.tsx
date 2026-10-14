import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { MarkAllRead } from "@/components/common/mark-all-read";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/format";
import { myNotifications } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const items = await myNotifications(user.id, 100);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Booking updates, organizer decisions, payments and refunds."
        actions={unread > 0 ? <MarkAllRead /> : null}
      />
      {items.length === 0 ? (
        <EmptyState className="mt-8" icon={BellOff} title="No notifications yet" description="Updates about your bookings will appear here." />
      ) : (
        <ul className="surface mt-8 divide-y">
          {items.map((n) => {
            const body = (
              <div className="flex gap-3 px-4 py-4 sm:px-5">
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-border" : "bg-signal")} aria-label={n.readAt ? undefined : "Unread"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <p className={cn("text-sm", !n.readAt && "font-semibold")}>{n.title}</p>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={n.createdAt.toISOString()} title={formatDateTime(n.createdAt)}>
                      {relativeTime(n.createdAt)}
                    </time>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className="block transition-colors hover:bg-secondary/60">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
