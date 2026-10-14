import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { checkIns } from "@/db/schema";
import { Scanner } from "@/components/organizer/scanner";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatRange } from "@/lib/format";
import { canScanEvent } from "@/lib/server/moderators";

export const metadata: Metadata = { title: "Scan tickets" };

export default async function ModeratorScanPage({ params }: PageProps<"/moderate/[eventId]">) {
  const { eventId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const user = await requirePageUser();
  const access = await canScanEvent(user, eventId);
  if (!access) notFound();
  const { event } = access;
  const [{ n }] = await db.select({ n: count() }).from(checkIns).where(eq(checkIns.eventId, eventId));
  const now = new Date();
  const windowState = event.status === "cancelled" ? "cancelled" : now < event.checkinOpensAt ? "before" : now > event.checkinClosesAt ? "after" : "open";
  return (
    <>
      <Link href="/moderate" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Check-in duty
      </Link>
      <p className="eyebrow">{access.via === "moderator" ? "Moderator scanner" : "Scanner"}</p>
      <h1 className="font-display mt-2 text-[2.25rem] leading-[1.05] text-balance">{event.title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {formatRange(event.startAt, event.endAt)} · {event.venue}
      </p>
      <Scanner
        eventId={event.id}
        initialCount={n}
        windowState={windowState}
        windowLabel={`${formatDateTime(event.checkinOpensAt)} – ${formatDateTime(event.checkinClosesAt)}`}
      />
    </>
  );
}
