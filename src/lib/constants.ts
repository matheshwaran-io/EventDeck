import type { BookingStatus, EventCategory, ParticipantCategory, PaymentStatus, RefundStatus } from "@/db/schema";

export const APP_NAME = "EventDeck";
export const UNIVERSITY_NAME = process.env.NEXT_PUBLIC_UNIVERSITY_NAME || "Northfield University";
export const APP_TIMEZONE = "Asia/Kolkata";
export const APP_TZ_OFFSET = "+05:30";
export const HOLD_MINUTES = 10;
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "cultural", label: "Cultural" },
  { value: "academic", label: "Academic" },
  { value: "workshop", label: "Workshop" },
  { value: "sports", label: "Sports" },
  { value: "career", label: "Career" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
];

export const PARTICIPANT_CATEGORIES: { value: ParticipantCategory; label: string }[] = [
  { value: "host_student", label: "Student (this university)" },
  { value: "external_student", label: "Student (other college)" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "alumni", label: "Alumni" },
  { value: "guest", label: "Guest" },
];

export const categoryLabel = (c: EventCategory) => EVENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const participantLabel = (c: ParticipantCategory) =>
  PARTICIPANT_CATEGORIES.find((x) => x.value === c)?.label ?? c;

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "warning" },
  pending_verification: { label: "Pending verification", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  event_cancelled: { label: "Event cancelled", tone: "danger" },
  payment_exception: { label: "Payment exception", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  not_required: { label: "No payment", tone: "neutral" },
  pending: { label: "Payment pending", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Payment failed", tone: "danger" },
  expired: { label: "Payment window closed", tone: "neutral" },
};

export const REFUND_STATUS: Record<RefundStatus, { label: string; tone: Tone }> = {
  not_applicable: { label: "—", tone: "neutral" },
  pending: { label: "Refund pending", tone: "warning" },
  processed: { label: "Refund processed", tone: "success" },
  failed: { label: "Refund failed", tone: "danger" },
};

export type { Tone };
