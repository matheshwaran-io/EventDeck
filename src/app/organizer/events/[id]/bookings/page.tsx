import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Inbox } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { BookingQueue } from "@/components/organizer/booking-queue";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { getManagedEvent } from "@/lib/server/events";
import { bookingCounts, eventBookings } from "@/lib/server/queries";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "review", label: "To verify" },
  { key: "passes", label: "Pass requests" },
  { key: "awaiting", label: "Awaiting payment" },
  { key: "approved", label: "Approved" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

export default async function EventBookingsPage({ params, searchParams }: PageProps<"/organizer/events/[id]/bookings">) {
  const { id } = await params;
  const { f } = await searchParams;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const filter = FILTERS.find((x) => x.key === f)?.key ?? "review";
  const [rows, counts] = await Promise.all([eventBookings(id, filter), bookingCounts(id)]);
  const canDecide = data.event.status !== "cancelled";

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={`/organizer/events/${id}/bookings${x.key === "review" ? "" : `?f=${x.key}`}`}
              role="tab"
              aria-selected={filter === x.key}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === x.key ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
              <span className="text-xs opacity-70 tabular">{counts[x.key]}</span>
            </Link>
          ))}
        </div>
        <a href={`/api/reports/bookings?eventId=${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download /> Export CSV
        </a>
      </div>
      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={filter === "review" || filter === "passes" ? "Nothing to verify" : "No bookings here"}
            description={filter === "review" ? "New paid and free bookings appear here for approval." : undefined}
          />
        ) : (
          <BookingQueue
            canDecide={canDecide}
            rows={rows.map((r) => ({
              id: r.booking.id,
              reference: r.booking.reference,
              kind: r.booking.kind,
              status: r.booking.status,
              paymentStatus: r.booking.paymentStatus,
              refundStatus: r.booking.refundStatus,
              quantity: r.booking.quantity,
              amountPaise: r.booking.amountPaise,
              attendeeNames: r.booking.attendeeNames,
              passReason: r.booking.passReason,
              decisionNote: r.booking.decisionNote,
              createdAt: r.booking.createdAt.toISOString(),
              buyer: r.buyer,
              tiers: r.tiers,
              paymentRef: r.paymentRef,
            }))}
          />
        )}
      </div>
    </>
  );
}
