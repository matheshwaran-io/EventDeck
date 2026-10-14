import { notFound } from "next/navigation";
import { EventForm } from "@/components/organizer/event-form";
import { requirePageUser } from "@/lib/auth";
import { toLocalInput } from "@/lib/format";
import { getManagedEvent } from "@/lib/server/events";

export default async function EditEventPage({ params }: PageProps<"/organizer/events/[id]/edit">) {
  const { id } = await params;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const { event, tiers } = data;
  if (event.status === "cancelled") {
    return <p className="rounded-xl border bg-secondary p-6 text-sm text-muted-foreground">Cancelled events can&apos;t be edited.</p>;
  }
  return (
    <EventForm
      mode="edit"
      eventId={event.id}
      isPublished={event.status === "published"}
      currentPoster={event.posterPath}
      allocatedByTier={Object.fromEntries(tiers.map((t) => [t.id, t.allocated]))}
      defaults={{
        title: event.title,
        summary: event.summary,
        description: event.description,
        category: event.category,
        venue: event.venue,
        startAt: toLocalInput(event.startAt),
        endAt: toLocalInput(event.endAt),
        registrationClosesAt: toLocalInput(event.registrationClosesAt),
        checkinOpensAt: toLocalInput(event.checkinOpensAt),
        checkinClosesAt: toLocalInput(event.checkinClosesAt),
        visibility: event.visibility,
        maxTicketsPerBooking: event.maxTicketsPerBooking,
        eligibleCategories: event.eligibleCategories,
        allowPassRequests: event.allowPassRequests,
        eligibleInstitutionTypes: event.eligibleInstitutionTypes,
        eligibleCampuses: event.eligibleCampuses,
        eligibleInstitutions: event.eligibleInstitutions,
        tiers: tiers.map((t) => ({ id: t.id, name: t.name, description: t.description, priceRupees: t.pricePaise / 100, capacity: t.capacity })),
      }}
    />
  );
}
