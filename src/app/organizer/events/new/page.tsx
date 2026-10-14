import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { EventForm } from "@/components/organizer/event-form";
import { defaultEventValues } from "@/lib/event-defaults";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requirePageUser(["organizer", "admin"]);
  return (
    <>
      <PageHeader eyebrow="Organizer" title="Create an event" description="Save as a draft to keep working, or publish immediately." />
      <EventForm mode="create" defaults={defaultEventValues()} />
    </>
  );
}
