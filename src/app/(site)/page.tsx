import Link from "next/link";
import { ArrowRight, CalendarCheck2, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { cardDate, EventCard, priceLabel } from "@/components/events/event-card";
import { HeroCarousel, type HeroSlide } from "@/components/events/hero-carousel";
import { PosterRail, RailItem } from "@/components/events/poster-rail";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel, EVENT_CATEGORIES, UNIVERSITY_NAME } from "@/lib/constants";
import { describeAudience } from "@/lib/domain/eligibility";
import { categoryCounts, featuredEvents, type EventCard as EventCardData } from "@/lib/server/events";

export default async function HomePage() {
  const [events, posterEvents, counts, user] = await Promise.all([
    featuredEvents(24),
    featuredEvents(6, { withPoster: true }),
    categoryCounts(),
    getCurrentUser(),
  ]);
  const countFor = (c: string) => counts.find((x) => x.category === c)?.n ?? 0;

  // Hero: events with real posters first (they carry the carousel), then the soonest others.
  const heroEvents = [...posterEvents, ...events.filter((e) => !posterEvents.some((p) => p.id === e.id))].slice(0, 6);
  const slides: HeroSlide[] = heroEvents.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    venue: e.venue,
    category: e.category,
    posterPath: e.posterPath,
    startAt: e.startAt.toISOString(),
    dateLabel: cardDate(e.startAt),
    priceLabel: priceLabel(e.minPricePaise, e.maxPricePaise),
    audienceLabel: describeAudience(e).label,
  }));

  // Rails: poster events first so real artwork leads each row.
  const railEvents = [...posterEvents, ...events.filter((e) => !posterEvents.some((p) => p.id === e.id))];
  const byCategory = new Map<string, EventCardData[]>();
  for (const e of railEvents) byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e]);
  const categoryRails = [...byCategory.entries()].filter(([, list]) => list.length >= 2).slice(0, 3);
  const openToAll = railEvents.filter((e) => e.eligibleInstitutionTypes.includes("EXTERNAL_INSTITUTION"));

  return (
    <div className="page-enter">
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-signal" /> {UNIVERSITY_NAME}
            </p>
            <h1 className="font-display mt-2 text-[2.5rem] leading-none sm:text-[3.25rem]">
              What&apos;s on <em className="text-signal">campus</em>
            </h1>
          </div>
          <form action="/events" className="flex w-full max-w-md items-center gap-2 rounded-xl border bg-card p-1.5 shadow-[var(--shadow-soft)] focus-within:border-signal focus-within:ring-3 focus-within:ring-ring/25">
            <Search className="ml-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <label htmlFor="hero-q" className="sr-only">Search events</label>
            <input id="hero-q" name="q" placeholder="Search fests, workshops, roadshows…" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm" />
            <button type="submit" className={buttonVariants({ className: "shrink-0" })}>
              Search
            </button>
          </form>
        </div>
        {slides.length ? (
          <HeroCarousel slides={slides} />
        ) : (
          <EmptyState icon={CalendarCheck2} title="No upcoming events yet" description="Check back soon — organizers are planning the next season." />
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8" aria-label="Browse by category">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {EVENT_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/events?category=${c.value}`}
              className="group flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-secondary"
            >
              {c.label}
              <span className="rounded-full bg-secondary px-1.5 text-xs text-muted-foreground tabular group-hover:bg-background">{countFor(c.value)}</span>
            </Link>
          ))}
        </div>
      </section>

      {events.length > 0 && (
        <RailSection title="Featured on campus" href="/events">
          {railEvents.slice(0, 12).map((e, i) => (
            <RailItem key={e.id}>
              <EventCard event={e} priority={i < 5} />
            </RailItem>
          ))}
        </RailSection>
      )}

      {openToAll.length >= 2 && (
        <RailSection title="Open to all colleges" href="/events?audience=intercollege">
          {openToAll.slice(0, 12).map((e) => (
            <RailItem key={e.id}>
              <EventCard event={e} />
            </RailItem>
          ))}
        </RailSection>
      )}

      {categoryRails.map(([cat, list]) => (
        <RailSection key={cat} title={`${categoryLabel(cat as EventCardData["category"])} events`} href={`/events?category=${cat}`}>
          {list.slice(0, 12).map((e) => (
            <RailItem key={e.id}>
              <EventCard event={e} />
            </RailItem>
          ))}
        </RailSection>
      ))}

      {/* Host band */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-foreground px-6 py-10 text-background sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border-[28px] border-background/5" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="eyebrow text-background/50">For clubs, departments & societies</p>
              <h2 className="font-display mt-3 text-[2.5rem] leading-[1] text-balance sm:text-[3rem]">
                Run your event like a <em className="text-signal">box office.</em>
              </h2>
              <p className="mt-4 max-w-md text-background/70">
                Ticket tiers, verified bookings, complimentary passes and a phone-camera scanner at the door — with every decision on record.
              </p>
              <Link
                href={user ? (user.role === "participant" ? "/my/profile#organizer" : "/organizer") : "/signup"}
                className={buttonVariants({ variant: "signal", size: "lg", className: "mt-7" })}
              >
                {user?.role === "organizer" || user?.role === "admin" ? "Open dashboard" : "Apply to host"} <ArrowRight />
              </Link>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-xl bg-background/10 sm:grid-cols-3">
              {[
                ["01", "Publish", "Create tiers, limits, deadlines and eligibility. Go live instantly once approved."],
                ["02", "Verify", "Approve paid bookings and pass requests from one queue."],
                ["03", "Scan", "Check guests in with any phone. Duplicate scans are refused."],
              ].map(([n, t, d]) => (
                <li key={n} className="bg-foreground p-5">
                  <p className="font-mono text-xs text-signal">{n}</p>
                  <p className="mt-3 font-semibold">{t}</p>
                  <p className="mt-1.5 text-sm text-background/60">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

function RailSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-display text-[2rem] leading-none">{title}</h2>
        <Link href={href} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          See all <ArrowRight className="size-4" />
        </Link>
      </div>
      <PosterRail label={title}>{children}</PosterRail>
    </section>
  );
}
