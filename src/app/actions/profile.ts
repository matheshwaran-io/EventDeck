"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { toActionError, type ActionResult } from "@/lib/server/errors";
import { applyForOrganizer, updateOwnProfile } from "@/lib/server/users";
import { organizerApplicationSchema, profileSchema, type ProfileInput } from "@/lib/validation/auth";

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    await updateOwnProfile(user, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function applyOrganizerAction(input: { organization: string; reason: string }): Promise<ActionResult> {
  try {
    const user = await requireUser(["participant"]);
    const parsed = organizerApplicationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    await applyForOrganizer(user, parsed.data);
    revalidatePath("/my/profile");
    return { ok: true, message: "Application submitted. An administrator will review it." };
  } catch (err) {
    return toActionError(err);
  }
}
