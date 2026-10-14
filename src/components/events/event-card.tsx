import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { EventCard as EventCardData } from "@/lib/server/events";
import { categoryLabel } from "@/lib/constants";
import { formatPaise, formatShortDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PosterArt } from "./poster-art";

export function priceLabel(min: number | null, max: number | null) {
  if (min === null) return "—";
  if (max === null || min === max) return formatPaise(min);
  return min === 0 ? `Free – ${formatPaise(max)}` : `From ${formatPaise(min)}`;
}

export function AvailabilityNote({ remaining, capacity }: { remaining: number; capacity: number }) {
  if (capacity === 0) return null;
  if (remaining <= 0) return <span className="font-medium text-destructive">Sold out</span>;
  if (remaining / capacity <= 0.15 || remaining <= 10)
    return <span className="font-medium text-signal">Only {remaining} left</span>;
  return <span className="text-muted-foreground">{remaining} available</span>;
}

export function EventCard({ event, className, priority }: { event: EventCardData; className?: string; priority?: boolean }) {
  const closed = event.registrationClosesAt <= new Date();
  return (
    <Link
      href={`/events/${event.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="relative">
        <PosterArt
          title={event.title}
          category={event.category}
          startAt={event.startAt}
          posterPath={event.posterPath}
          seed={event.slug}
          priority={priority}
          className="aspect-[4/3]"
        />
        <span className="absolute right-3 bottom-3 grid size-8 translate-y-1 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono tracking-wide uppercase">{categoryLabel(event.category)}</span>
          <span aria-hidden>·</span>
          <time dateTime={event.startAt.toISOString()}>
            {formatShortDate(event.startAt)}, {formatTime(event.startAt)}
          </time>
        </div>
        <h3 className="line-clamp-2 text-[1.0625rem] leading-snug font-semibold tracking-tight text-balance">{event.title}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{event.venue}</span>
        </p>
        <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm">
          <span className="font-semibold tabular">{priceLabel(event.minPricePaise, event.maxPricePaise)}</span>
          {event.status === "cancelled" ? (
            <span className="font-medium text-destructive">Cancelled</span>
          ) : closed ? (
            <span className="text-muted-foreground">Registration closed</span>
          ) : (
            <AvailabilityNote remaining={event.remaining} capacity={event.capacity} />
          )}
        </div>
      </div>
    </Link>
  );
}
