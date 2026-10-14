import type { BookingStatus, PaymentStatus, RefundStatus } from "@/db/schema";

/**
 * Allowed booking lifecycle transitions. Every server-side status change goes
 * through `assertBookingTransition` and a compare-and-set UPDATE, so a client
 * can never move a booking to an arbitrary state.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  awaiting_payment: ["approved", "pending_verification", "cancelled", "expired", "event_cancelled"],
  // -> cancelled only for unpaid (free / complimentary) requests; enforced in the service.
  pending_verification: ["approved", "rejected", "cancelled", "event_cancelled"],
  approved: ["event_cancelled"],
  rejected: [],
  // A verified payment can still arrive for a closed hold; it is either
  // re-allocated (-> approved / pending_verification) or parked as an exception.
  cancelled: ["approved", "pending_verification", "payment_exception"],
  expired: ["approved", "pending_verification", "payment_exception"],
  event_cancelled: [],
  payment_exception: [],
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  not_required: [],
  pending: ["paid", "failed", "expired"],
  failed: ["pending", "paid", "expired"],
  expired: ["paid"],
  paid: [],
};

export const REFUND_TRANSITIONS: Record<RefundStatus, readonly RefundStatus[]> = {
  not_applicable: ["pending"],
  pending: ["processed", "failed"],
  failed: ["pending", "processed"],
  processed: [],
};

export function canTransition<S extends string>(map: Record<S, readonly S[]>, from: S, to: S) {
  return map[from]?.includes(to) ?? false;
}

export class TransitionError extends Error {}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus) {
  if (!canTransition(BOOKING_TRANSITIONS, from, to)) {
    throw new TransitionError(`Booking cannot move from ${from} to ${to}`);
  }
}

/** Statuses from which a booking holds inventory. */
export const INVENTORY_HOLDING: readonly BookingStatus[] = ["awaiting_payment", "pending_verification", "approved"];

/** Statuses that represent an active, upcoming-relevant booking for the participant. */
export const ACTIVE_BOOKING: readonly BookingStatus[] = ["awaiting_payment", "pending_verification", "approved"];

/** Ticket is valid only when every independent gate passes. */
export function ticketsShouldBeValid(input: {
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  eventStatus: "draft" | "published" | "cancelled";
}) {
  return (
    input.bookingStatus === "approved" &&
    (input.paymentStatus === "paid" || input.paymentStatus === "not_required") &&
    input.eventStatus !== "cancelled"
  );
}
