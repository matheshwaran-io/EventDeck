import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { EmptyState } from "@/components/common/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { eventCategory, type EventCategory } from "@/db/schema";
import { categoryLabel } from "@/lib/constants";
import { fromLocalInput } from "@/lib/format";
import { searchEvents, venues } from "@/lib/server/events";

export const metadata: Metadata = { title: "Discover events" };

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v.slice(0, 120) : undefined;
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const sp = await searchParams;
  const q = str(sp.q)?.trim();
  const categoryRaw = str(sp.category);
  const category = (eventCategory.enumValues as readonly string[]).includes(categoryRaw ?? "") ? (categoryRaw as EventCategory) : undefined;
  const from = str(sp.from);
  const to = str(sp.to);
  const venue = str(sp.venue);
  const available = sp.available === "1";
  const free = sp.free === "1";
  const audience = sp.audience === "srm" || sp.audience === "intercollege" || sp.audience === "open" ? sp.audience : undefined;
  const when = sp.when === "past" ? "past" : "upcoming";
  const page = Number(str(sp.page) ?? 1) || 1;

  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const [result, venueList] = await Promise.all([
    searchEvents({
      q,
      category,
      from: valid(from) ? fromLocalInput(`${from}T00:00`) : undefined,
      to: valid(to) ? fromLocalInput(`${to}T23:59`) : undefined,
      venue,
      available,
      free,
      audience,
      when,
      page,
    }),
    venues(),
  ]);

  const params = new URLSearchParams();
  Object.entries({ q, category, from, to, venue, available: available ? "1" : undefined, free: free ? "1" : undefined, audience, when: when === "past" ? "past" : undefined }).forEach(
    ([k, v]) => v && params.set(k, v),
  );
  const pageHref = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    return `/events?${next}`;
  };
  const filtered = params.size > 0;

  return (
    <div className="page-enter mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="eyebrow">{when === "past" ? "Archive" : "Discover"}</p>
        <h1 className="font-display mt-2 text-[2.75rem] leading-none sm:text-[3.5rem]">
          {category ? categoryLabel(category) : when === "past" ? "Past events" : "What's on"}
          {q && <span className="text-muted-foreground"> · “{q}”</span>}
        </h1>
      </div>

      <EventFilters venues={venueList} />

      <div className="mt-6 mb-4 flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
        <p>
          <span className="font-medium text-foreground tabular">{result.total}</span> {result.total === 1 ? "event" : "events"}
          {filtered ? " match your filters" : when === "past" ? " in the archive" : " coming up"}
        </p>
        <Link href={when === "past" ? "/events" : "/events?when=past"} className="link-underline">
          {when === "past" ? "Upcoming events" : "Past events"}
        </Link>
      </div>

      {result.items.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
          {result.items.map((e, i) => (
            <EventCard key={e.id} event={e} priority={i < 3} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          title="No events match"
          description={q ? `Nothing found for “${q}”. Try a broader term or clear a filter.` : "Try widening the dates or clearing filters."}
          action={
            <Link href="/events" className={buttonVariants({ variant: "outline" })}>
              Clear all filters
            </Link>
          }
        />
      )}

      {result.pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
          {result.page > 1 && (
            <Link href={pageHref(result.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Previous
            </Link>
          )}
          <span className="px-3 text-sm text-muted-foreground tabular">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages && (
            <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
