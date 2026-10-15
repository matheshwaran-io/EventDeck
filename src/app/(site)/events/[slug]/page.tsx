import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CalendarDays, Clock, DoorOpen, Lock, MapPin, Settings2, Timer, UsersRound } from "lucide-react";
import { PosterArt } from "@/components/events/poster-art";
import { TicketSelector } from "@/components/events/ticket-selector";
import { StatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel, MAX_TICKETS_PER_PERSON, PARTICIPANT_CATEGORIES } from "@/lib/constants";
import { formatDate, formatDateTime, formatPaise, formatRange, formatTime } from "@/lib/format";
import { getEventForViewer } from "@/lib/server/events";
import { checkEligibility, describeAudience } from "@/lib/domain/eligibility";
import { participantCategory } from "@/db/schema";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEventForViewer(slug, null);
  if (!data) return { title: "Event" };
  return {
    title: data.event.title,
    description: data.event.summary,
    robots: data.event.visibility === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const data = await getEventForViewer(slug, user);
  if (!data) notFound();
  const { event, tiers, organizerName, canManage, heldByViewer } = data;
  const now = new Date();
  const allEligible = participantCategory.enumValues.every((c) => event.eligibleCategories.includes(c));
  const audience = describeAudience(event);
  const eligibility = user ? checkEligibility(event, user) : null;
  const eligibleLabels = PARTICIPANT_CATEGORIES.filter((c) => event.eligibleCategories.includes(c.value)).map((c) => c.label);

  const facts = [
    { icon: CalendarDays, label: "Date", value: formatDate(event.startAt) },
    { icon: Clock, label: "Time", value: `${formatTime(event.startAt)} – ${formatTime(event.endAt)}` },
    { icon: MapPin, label: "Venue", value: event.venue },
    { icon: Timer, label: "Registration closes", value: formatDateTime(event.registrationClosesAt) },
    { icon: DoorOpen, label: "Check-in", value: `${formatDateTime(event.checkinOpensAt)} – ${formatTime(event.checkinClosesAt)}` },
    { icon: Building2, label: "Audience", value: audience.label },
    { icon: UsersRound, label: "Open to", value: allEligible ? "Students, faculty, staff, alumni & guests" : eligibleLabels.join(", ") },
  ];

  return (
    <div className="page-enter pb-20 lg:pb-0">
      {(event.status !== "published" || event.visibility === "unlisted" || canManage) && (
        <div className="border-b bg-secondary/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
            {event.status === "draft" && <StatusBadge tone="warning">Draft — only you and admins can see this</StatusBadge>}
            {event.status === "cancelled" && <StatusBadge tone="danger">Cancelled</StatusBadge>}
            {event.visibility === "unlisted" && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="size-3.5" /> Unlisted — shared by direct link
              </span>
            )}
            {canManage && (
              <Link href={`/organizer/events/${event.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-auto" })}>
                <Settings2 /> Manage event
              </Link>
            )}
          </div>
        </div>
      )}

      {/* District-style header: title + date, then the full poster on a wide banner */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <p className="eyebrow">
          {categoryLabel(event.category)} · Hosted by {organizerName}
        </p>
        <h1 className="font-display mt-2 text-[2.25rem] leading-[1.02] text-balance sm:text-[3rem]">{event.title}</h1>
        <p className="mt-2 text-[0.95rem] font-medium text-signal">{formatRange(event.startAt, event.endAt)}</p>
        <PosterArt
          title={event.title}
          category={event.category}
          startAt={event.startAt}
          posterPath={event.posterPath}
          seed={event.slug}
          size="hero"
          priority
          className="mt-6 aspect-[4/5] w-full rounded-3xl shadow-[var(--shadow-soft)] ring-1 ring-black/5 sm:aspect-[16/10] lg:aspect-auto lg:h-[480px]"
        />
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14 lg:px-8 lg:py-10">
        <div className="min-w-0">
          <p className="max-w-2xl text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">{event.summary}</p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 sm:[&>div:last-child:nth-child(odd)]:col-span-2">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-3 bg-card p-4">
                <f.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="min-w-0">
                  <dt className="eyebrow text-[0.625rem]">{f.label}</dt>
                  <dd className="mt-1 text-sm font-medium">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {event.status === "cancelled" && event.cancellationReason && (
            <div className="mt-8 rounded-xl border border-destructive/20 bg-danger-soft p-5">
              <p className="font-semibold text-destructive">This event has been cancelled</p>
              <p className="mt-1 text-sm">{event.cancellationReason}</p>
              <p className="mt-2 text-sm text-muted-foreground">Tickets are void. Paid bookings are refunded automatically (Razorpay Test Mode).</p>
            </div>
          )}

          {event.description && (
            <section className="mt-10">
              <h2 className="eyebrow mb-4">About this event</h2>
              <div className="max-w-2xl space-y-4 text-[0.98rem] leading-[1.75] text-pretty">
                {event.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside id="tickets" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          <TicketSelector
            event={{
              id: event.id,
              slug: event.slug,
              status: event.status,
              maxPerBooking: Math.min(event.maxTicketsPerBooking, MAX_TICKETS_PER_PERSON),
              registrationClosesAt: event.registrationClosesAt.toISOString(),
              allowPassRequests: event.allowPassRequests,
            }}
            tiers={tiers.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              pricePaise: t.pricePaise,
              remaining: Math.max(0, t.capacity - t.allocated),
              capacity: t.capacity,
            }))}
            viewer={
              user
                ? {
                    name: user.fullName,
                    eligible: Boolean(eligibility?.ok),
                    ineligibleReason: eligibility && !eligibility.ok ? eligibility.reason : undefined,
                    held: heldByViewer,
                    isOwner: canManage,
                  }
                : null
            }
            closed={event.registrationClosesAt <= now}
          />
        </aside>
      </div>

      {event.status === "published" && event.registrationClosesAt > now && tiers.some((t) => t.capacity > t.allocated) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tickets from</p>
              <p className="font-semibold tabular">{formatPaise(Math.min(...tiers.map((t) => t.pricePaise)))}</p>
            </div>
            <a href="#tickets" className={buttonVariants({ size: "lg" })}>
              Get tickets
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
