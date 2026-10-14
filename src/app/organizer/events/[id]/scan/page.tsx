import { notFound } from "next/navigation";
import { Scanner } from "@/components/organizer/scanner";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getManagedEvent } from "@/lib/server/events";

export default async function ScanPage({ params }: PageProps<"/organizer/events/[id]/scan">) {
  const { id } = await params;
  const user = await requirePageUser(["organizer", "admin"]);
  const data = await getManagedEvent(user, id);
  if (!data) notFound();
  const { event, metrics } = data;
  const now = new Date();
  const windowState = event.status === "cancelled" ? "cancelled" : now < event.checkinOpensAt ? "before" : now > event.checkinClosesAt ? "after" : "open";
  return (
    <Scanner
      eventId={event.id}
      initialCount={metrics.checkedIn}
      windowState={windowState}
      windowLabel={`${formatDateTime(event.checkinOpensAt)} – ${formatDateTime(event.checkinClosesAt)}`}
    />
  );
}
