"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requestCancellation } from "@/lib/server/cancellations";
import { DomainError, toActionError, type ActionResult } from "@/lib/server/errors";
import { createEvent, setPoster, setPublished, updateEvent } from "@/lib/server/events";
import { removePoster, uploadPoster } from "@/lib/server/storage";
import { eventSchema } from "@/lib/validation/event";

function parsePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 40_000) throw new DomainError("Invalid form submission.");
  const parsed = eventSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(issue ? `${issue.path.join(".")}: ${issue.message}` : "Check the form.");
  }
  return parsed.data;
}

function posterFrom(formData: FormData) {
  const file = formData.get("poster");
  return file instanceof File && file.size > 0 ? file : null;
}

function refresh(eventId?: string, slug?: string) {
  revalidatePath("/organizer");
  revalidatePath("/events");
  revalidatePath("/");
  if (eventId) revalidatePath(`/organizer/events/${eventId}`, "layout");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function createEventAction(formData: FormData): Promise<ActionResult<{ eventId: string }>> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const input = parsePayload(formData);
    const publish = formData.get("intent") === "publish";
    const poster = posterFrom(formData);
    const event = await createEvent(user, input, publish);
    if (poster) {
      try {
        const path = await uploadPoster(poster, event.id);
        await setPoster(user, event.id, path);
      } catch (e) {
        refresh(event.id, event.slug);
        return { ok: true, data: { eventId: event.id }, message: `Event saved, but the poster wasn't: ${e instanceof Error ? e.message : "upload failed"}` };
      }
    }
    refresh(event.id, event.slug);
    return { ok: true, data: { eventId: event.id }, message: publish ? "Event published." : "Draft saved." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateEventAction(eventId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    if (!z.string().uuid().safeParse(eventId).success) throw new DomainError("Event not found.", "not_found");
    const input = parsePayload(formData);
    const event = await updateEvent(user, eventId, input);
    const poster = posterFrom(formData);
    if (poster) {
      const path = await uploadPoster(poster, eventId);
      const prev = await setPoster(user, eventId, path);
      if (prev) await removePoster(prev).catch(() => undefined);
    } else if (formData.get("removePoster") === "1") {
      const prev = await setPoster(user, eventId, null);
      if (prev) await removePoster(prev).catch(() => undefined);
    }
    refresh(eventId, event.slug);
    return { ok: true, message: "Changes saved." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setPublishedAction(eventId: string, publish: boolean, note?: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const event = await setPublished(user, eventId, publish, note);
    refresh(eventId, event.slug);
    revalidatePath("/admin/events");
    return { ok: true, message: publish ? "Event is live." : "Event unpublished — it no longer appears in listings." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function requestCancellationAction(eventId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const r = reason.trim();
    if (r.length < 15) return { ok: false, error: "Please explain the reason (15+ characters)." };
    await requestCancellation(user, eventId, r.slice(0, 1000));
    refresh(eventId);
    return { ok: true, message: "Cancellation requested. An administrator will review it." };
  } catch (err) {
    return toActionError(err);
  }
}
