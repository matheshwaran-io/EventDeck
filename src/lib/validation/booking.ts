import { z } from "zod";

export const bookingRequestSchema = z.object({
  eventId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(64),
  lines: z
    .array(z.object({ tierId: z.string().uuid(), quantity: z.number().int().min(0).max(10) }))
    .min(1)
    .max(8),
  attendeeNames: z.array(z.string().max(80)).max(10),
  passReason: z.string().trim().max(500).optional(),
});

export const passReasonSchema = z
  .string()
  .trim()
  .min(10, "Tell the organizer why you're eligible (10+ characters)")
  .max(500, "Keep it under 500 characters");

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
