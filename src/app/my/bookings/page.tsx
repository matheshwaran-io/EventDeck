import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, CreditCard, Ticket } from "lucide-react";
import { BookingBadges } from "@/components/bookings/booking-badges";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PosterArt } from "@/components/events/poster-art";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatPaise, formatTime } from "@/lib/format";
import { myBookings } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My tickets" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All bookings" },
] as const;

export default async function MyBookingsPage({ searchParams }: PageProps<"/my/bookings">) {
  const user = await requirePageUser();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as (typeof TABS)[number]["key"]) : "upcoming";
  const rows = await myBookings(user.id);
  const now = new Date();
  const live = ["awaiting_payment", "pending_verification", "approved"];
  const filtered = rows.filter((r) =>
    tab === "all" ? true : tab === "upcoming" ? r.event.endAt >= now && live.includes(r.booking.status) : r.event.endAt < now || !live.includes(r.booking.status),
  );
  const awaiting = rows.filter((r) => r.booking.status === "awaiting_payment");

  return (
    <>
      <PageHeader
        eyebrow={`Hi, ${user.fullName.split(" ")[0]}`}
        title="My tickets"
        description="Bookings, payments and tickets — all in one place."
        actions={
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Find events <ArrowRight />
          </Link>
        }
      />

      {awaiting.length > 0 && (
        <Link
          href={`/my/bookings/${awaiting[0]!.booking.id}`}
          className="mt-8 flex items-center gap-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3.5 transition-colors hover:border-warning/60"
        >
          <CreditCard className="size-5 shrink-0 text-[oklch(0.45_0.11_65)]" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Complete your payment</p>
            <p className="truncate text-muted-foreground">
              {awaiting.length === 1 ? awaiting[0]!.event.title : `${awaiting.length} bookings`} — seats are held for a limited time.
            </p>
          </div>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <nav className="mt-8 flex gap-1 border-b" aria-label="Booking filters">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "upcoming" ? "/my/bookings" : `/my/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-signal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={tab === "past" ? CalendarClock : Ticket}
          title={tab === "past" ? "Nothing here yet" : "No upcoming tickets"}
          description={tab === "past" ? "Past and closed bookings will appear here." : "When you book an event, your tickets show up here."}
          action={
            <Link href="/events" className={buttonVariants()}>
              Browse events
            </Link>
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map(({ booking, event, tiers }) => (
            <li key={booking.id}>
              <Link
                href={`/my/bookings/${booking.id}`}
                className="group flex gap-4 rounded-xl border bg-card p-3 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-[var(--shadow-lift)] sm:p-4"
              >
                <PosterArt
                  title={event.title}
                  category={event.category}
                  startAt={event.startAt}
                  posterPath={event.posterPath}
                  seed={event.slug}
                  size="thumb"
                  className="size-20 shrink-0 rounded-lg sm:size-24"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight">{event.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatDate(event.startAt)} · {formatTime(event.startAt)}
                      </p>
                    </div>
                    <BookingBadges booking={booking} compact />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">{booking.reference}</span>
                    <span>{tiers}</span>
                    <span className="font-medium text-foreground tabular">{booking.amountPaise ? formatPaise(booking.amountPaise) : "Free"}</span>
                  </div>
                </div>
                <ArrowRight className="hidden size-4 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
