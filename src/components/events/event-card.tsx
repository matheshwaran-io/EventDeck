import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/server/events";
import { formatPaise } from "@/lib/format";
import { APP_TIMEZONE } from "@/lib/constants";
import { describeAudience } from "@/lib/domain/eligibility";
import { cn } from "@/lib/utils";
import { PosterArt } from "./poster-art";

export function priceLabel(min: number | null, max: number | null) {
  if (min === null) return "—";
  if (max === null || min === max) return formatPaise(min);
  return min === 0 ? "Free onwards" : `${formatPaise(min)} onwards`;
}

/** "Sat, 17 Oct, 5:30 PM" — District-style compact date line. */
export function cardDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

export function AvailabilityNote({ remaining, capacity }: { remaining: number; capacity: number }) {
  if (capacity === 0) return null;
  if (remaining <= 0) return <span className="font-medium text-destructive">Sold out</span>;
  if (remaining / capacity <= 0.15 || remaining <= 10) return <span className="font-medium text-signal">Only {remaining} left</span>;
  return null;
}

/** Poster-first card: the full poster, then date · title · venue · price underneath (District style). */
export function EventCard({ event, className, priority }: { event: EventCardData; className?: string; priority?: boolean }) {
  const closed = event.registrationClosesAt <= new Date();
  const audience = describeAudience(event);
  const status =
    event.status === "cancelled" ? (
      <span className="font-medium text-destructive">Cancelled</span>
    ) : closed ? (
      <span className="text-muted-foreground">Registration closed</span>
    ) : (
      <AvailabilityNote remaining={event.remaining} capacity={event.capacity} />
    );
  return (
    <Link href={`/events/${event.slug}`} className={cn("group flex min-w-0 flex-col gap-3 rounded-2xl outline-offset-4", className)}>
      <div className="relative overflow-hidden rounded-2xl shadow-[var(--shadow-soft)] ring-1 ring-black/5 transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-lift)]">
        <PosterArt
          title={event.title}
          category={event.category}
          startAt={event.startAt}
          posterPath={event.posterPath}
          seed={event.slug}
          priority={priority}
          className="aspect-[3/4] w-full"
        />
        {audience.scope !== "open" && (
          <span className="absolute top-2.5 left-2.5 max-w-[85%] truncate rounded-full bg-background/92 px-2.5 py-1 text-[0.6875rem] font-medium text-foreground shadow-sm backdrop-blur">
            {audience.label}
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-1 px-0.5">
        <p className="text-[0.8125rem] font-medium text-signal">
          <time dateTime={event.startAt.toISOString()}>{cardDate(event.startAt)}</time>
        </p>
        <h3 className="line-clamp-2 text-[0.98rem] leading-snug font-semibold tracking-tight text-balance">{event.title}</h3>
        <p className="truncate text-[0.8125rem] text-muted-foreground">{event.venue}</p>
        <p className="flex items-center justify-between gap-2 pt-0.5 text-[0.8125rem]">
          <span className="font-medium tabular">{priceLabel(event.minPricePaise, event.maxPricePaise)}</span>
          {status && <span className="text-xs">{status}</span>}
        </p>
      </div>
    </Link>
  );
}
