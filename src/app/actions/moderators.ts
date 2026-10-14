"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { toActionError, type ActionResult } from "@/lib/server/errors";
import { addModerator, revokeModerator } from "@/lib/server/moderators";

const uuid = z.string().uuid();

export async function addModeratorAction(eventId: string, email: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    if (!uuid.safeParse(eventId).success) return { ok: false, error: "Event not found." };
    const row = await addModerator(user, eventId, String(email ?? "").slice(0, 254));
    revalidatePath(`/organizer/events/${eventId}/team`);
    return { ok: true, message: `${row.name} can now scan tickets for this event.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeModeratorAction(eventId: string, moderatorId: string): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    if (!uuid.safeParse(eventId).success || !uuid.safeParse(moderatorId).success) return { ok: false, error: "Not found." };
    await revokeModerator(user, eventId, moderatorId);
    revalidatePath(`/organizer/events/${eventId}/team`);
    return { ok: true, message: "Access revoked. Their next scan will be refused." };
  } catch (err) {
    return toActionError(err);
  }
}
