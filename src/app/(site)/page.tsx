import Link from "next/link";
import { ArrowRight, CalendarCheck2, QrCode, Search, ShieldCheck, Ticket } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { PosterArt } from "@/components/events/poster-art";
import { EmptyState } from "@/components/common/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_CATEGORIES, UNIVERSITY_NAME } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { categoryCounts, featuredEvents } from "@/lib/server/events";

export default async function HomePage() {
  const [events, counts, user] = await Promise.all([featuredEvents(9), categoryCounts(), getCurrentUser()]);
  const lead = events[0];
  const stack = events.slice(1, 3);
  const countFor = (c: string) => counts.find((x) => x.category === c)?.n ?? 0;
  const term = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-20">
          <div className="flex flex-col justify-center">
            <p className="eyebrow mb-5 flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-signal" /> {UNIVERSITY_NAME} · {term}
            </p>
            <h1 className="font-display text-[3.1rem] leading-[0.95] tracking-tight text-balance sm:text-[4.25rem] lg:text-[5rem]">
              Everything happening on campus, <em className="text-signal">in one place.</em>
            </h1>
            <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">
              Find talks, festivals, workshops and matches. Book seats in seconds, carry your tickets on your phone, and walk in with a scan.
            </p>
            <form action="/events" className="mt-8 flex max-w-xl items-center gap-2 rounded-xl border bg-card p-1.5 shadow-[var(--shadow-soft)] focus-within:border-signal focus-within:ring-3 focus-within:ring-ring/25">
              <Search className="ml-2.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <label htmlFor="hero-q" className="sr-only">Search events</label>
              <input
                id="hero-q"
                name="q"
                placeholder="Search hackathon, concert, workshop…"
                className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm"
              />
              <button type="submit" className={buttonVariants({ className: "shrink-0" })}>
                Search
              </button>
            </form>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Ticket className="size-4" /> Multi-ticket booking</span>
              <span className="flex items-center gap-2"><QrCode className="size-4" /> QR entry</span>
              <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Verified by organizers</span>
            </div>
          </div>

          {lead ? (
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-[4/5]">
                {stack[1] && (
                  <PosterArt
                    title={stack[1].title}
                    category={stack[1].category}
                    startAt={stack[1].startAt}
                    posterPath={stack[1].posterPath}
                    seed={stack[1].slug}
                    className="absolute top-6 -right-2 hidden h-[78%] w-[62%] rotate-[5deg] rounded-xl opacity-90 shadow-[var(--shadow-lift)] sm:block"
                  />
                )}
                {stack[0] && (
                  <PosterArt
                    title={stack[0].title}
                    category={stack[0].category}
                    startAt={stack[0].startAt}
                    posterPath={stack[0].posterPath}
                    seed={stack[0].slug}
                    className="absolute top-14 -left-3 hidden h-[72%] w-[56%] -rotate-[6deg] rounded-xl opacity-90 shadow-[var(--shadow-lift)] sm:block"
                  />
                )}
                <Link
                  href={`/events/${lead.slug}`}
                  className="group absolute inset-x-[8%] inset-y-0 block overflow-hidden rounded-2xl shadow-[var(--shadow-lift)] ring-1 ring-black/5 transition-transform duration-300 hover:-translate-y-1 sm:inset-x-[14%]"
                >
                  <PosterArt
                    title={lead.title}
                    category={lead.category}
                    startAt={lead.startAt}
                    posterPath={lead.posterPath}
                    seed={lead.slug}
                    size="hero"
                    priority
                    className="absolute inset-0"
                  />
                  <div className="absolute inset-x-3 bottom-3 rounded-xl bg-background/95 p-4 shadow-sm backdrop-blur">
                    <p className="eyebrow text-[0.625rem]">Up next</p>
                    <p className="mt-1 line-clamp-1 font-semibold">{lead.title}</p>
                    <p className="mt-0.5 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatDate(lead.startAt)} · {formatTime(lead.startAt)}</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {EVENT_CATEGORIES.map((c) => {
            const n = countFor(c.value);
            return (
              <Link
                key={c.value}
                href={`/events?category=${c.value}`}
                className="group flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-secondary"
              >
                {c.label}
                <span className="rounded-full bg-secondary px-1.5 text-xs text-muted-foreground tabular group-hover:bg-background">{n}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Upcoming</p>
            <h2 className="font-display mt-1 text-[2.25rem] leading-none">On the calendar</h2>
          </div>
          <Link href="/events" className={buttonVariants({ variant: "outline", size: "sm" })}>
            All events <ArrowRight />
          </Link>
        </div>
        {events.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((e, i) => (
              <EventCard key={e.id} event={e} priority={i < 3} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarCheck2} title="No upcoming events yet" description="Check back soon — organizers are planning the next season." />
        )}
      </section>

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
