import { formatDateTime } from "@/lib/format";

const LABELS: Record<string, string> = {
  "booking.created": "created a booking",
  "booking.approved": "approved a booking",
  "booking.rejected": "rejected a booking",
  "booking.cancelled": "cancelled a booking",
  "booking.expired": "— a reservation expired",
  "payment.order_created": "started a payment",
  "payment.captured": "— payment confirmed",
  "payment.failed": "— payment failed",
  "payment.duplicate_detected": "— duplicate payment detected",
  "payment.signature_invalid": "— payment signature rejected",
  "payment.exception_resolved": "resolved a payment exception",
  "checkin.accepted": "checked in a ticket",
  "checkin.duplicate": "scanned an already-used ticket",
  "checkin.rejected": "scanned an invalid ticket",
  "event.created": "created the event as a draft",
  "event.created_published": "created and published the event",
  "event.updated": "edited the event",
  "event.published": "published the event",
  "event.unpublished": "unpublished the event",
  "event.poster_updated": "updated the poster",
  "event.poster_removed": "removed the poster",
  "event.cancellation_requested": "requested cancellation",
  "event.cancellation_rejected": "declined the cancellation request",
  "event.cancelled": "cancelled the event",
  "refund.processed": "processed a refund",
  "refund.pending": "submitted a refund",
  "refund.failed": "— refund failed",
  "report.exported": "exported a report",
  "organizer.applied": "applied to become an organizer",
  "organizer.approved": "approved an organizer",
  "organizer.rejected": "declined an organizer application",
  "user.role_changed": "changed a user's role",
  "user.deactivated": "deactivated an account",
  "user.reactivated": "reactivated an account",
  "user.admin_provisioned": "— administrator provisioned",
  "moderator.added": "added a check-in moderator",
  "moderator.revoked": "removed a check-in moderator",
};

export const describeAction = (action: string) => LABELS[action] ?? action.replace(/[._]/g, " ");

export function detailSummary(details: Record<string, unknown>) {
  const keys = ["moderator", "reference", "ticketNumber", "title", "reason", "note", "outcome", "from", "to", "rows", "organization"];
  return keys
    .filter((k) => details[k] !== undefined && details[k] !== null && details[k] !== "")
    .map((k) => `${k}: ${String(details[k]).slice(0, 80)}`)
    .join(" · ");
}

export { formatDateTime };
