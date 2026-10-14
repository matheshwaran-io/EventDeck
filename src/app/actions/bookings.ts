"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { cancelOwnBooking, createBooking, decideBooking } from "@/lib/server/bookings";
import { toActionError, type ActionResult } from "@/lib/server/errors";
import { bookingRequestSchema, passReasonSchema, type BookingRequest } from "@/lib/validation/booking";

export async function createBookingAction(input: BookingRequest): Promise<ActionResult<{ bookingId: string; status: string }>> {
  try {
    const user = await requireUser();
    const parsed = bookingRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Please check your ticket selection." };
    let complimentary: { reason: string } | undefined;
    if (parsed.data.passReason !== undefined) {
      const reason = passReasonSchema.safeParse(parsed.data.passReason);
      if (!reason.success) return { ok: false, error: reason.error.issues[0]!.message };
      complimentary = { reason: reason.data };
    }
    const booking = await createBooking(user, { ...parsed.data, complimentary });
    revalidatePath("/my/bookings");
    return { ok: true, data: { bookingId: booking.id, status: booking.status } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelBookingAction(bookingId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!z.string().uuid().safeParse(bookingId).success) return { ok: false, error: "Booking not found." };
    await cancelOwnBooking(user, bookingId);
    revalidatePath(`/my/bookings/${bookingId}`);
    revalidatePath("/my/bookings");
    return { ok: true, message: "Booking cancelled and tickets released." };
  } catch (err) {
    return toActionError(err);
  }
}

const decisionSchema = z.object({
  bookingId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export async function decideBookingAction(input: z.infer<typeof decisionSchema>): Promise<ActionResult> {
  try {
    const user = await requireUser(["organizer", "admin"]);
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    if (parsed.data.decision === "reject" && !parsed.data.note?.trim()) {
      return { ok: false, error: "Add a short reason so the participant knows why." };
    }
    const row = await decideBooking(user, parsed.data.bookingId, parsed.data.decision, parsed.data.note);
    revalidatePath(`/organizer/events/${row.eventId}/bookings`);
    revalidatePath(`/organizer/events/${row.eventId}`);
    revalidatePath("/organizer");
    return { ok: true, message: parsed.data.decision === "approve" ? "Approved — tickets issued." : "Booking rejected." };
  } catch (err) {
    return toActionError(err);
  }
}
