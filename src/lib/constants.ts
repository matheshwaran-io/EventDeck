import type { BookingStatus, EventCategory, ParticipantCategory, PaymentStatus, RefundStatus } from "@/db/schema";

export const APP_NAME = "EventDeck";
export const UNIVERSITY_NAME = process.env.NEXT_PUBLIC_UNIVERSITY_NAME || "SRM University, KTR Campus";
export const APP_TIMEZONE = "Asia/Kolkata";
export const APP_TZ_OFFSET = "+05:30";
export const HOLD_MINUTES = 10;
export const MAX_POSTER_BYTES = 2 * 1024 * 1024;
export { PRODUCTION_URL, getAppUrl, getAuthRedirectUrl } from "./url";

/** SRM Institute of Science & Technology email domain regex */
export const SRM_EMAIL_REGEX = /^[^@]+@([a-z0-9-]+\.)*(srmist\.edu\.in|srmuniv\.ac\.in)$/i;

export function isSrmEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (SRM_EMAIL_REGEX.test(trimmed)) return true;
  // Support testing environments with test domains
  if (process.env.NODE_ENV !== "production" && (trimmed.endsWith("@eventdeck.test") || trimmed.endsWith("@uems.test"))) {
    return true;
  }
  return false;
}

/** Permanent Root Administrator email: cannot be removed, demoted, deactivated, or deleted. */
export const ROOT_ADMIN_EMAIL = "eventdeck88@gmail.com";

export function isRootAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
}


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
  { value: "host_student", label: "SRM Student" },
  { value: "external_student", label: "Student (Other College)" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "alumni", label: "Alumni" },
  { value: "guest", label: "Guest" },
];

export const INSTITUTION_TYPES = [
  { value: "SRM", label: "SRM University", description: "Students, faculty, staff, & alumni across all SRM campuses" },
  { value: "EXTERNAL_INSTITUTION", label: "Other College / University", description: "Participants from universities or colleges (e.g. VIT, Anna Univ, etc.)" },
  { value: "GUEST", label: "Guest", description: "Visitors, industry professionals, and external guests" },
] as const;

export const SRM_CAMPUSES = [
  { value: "KTR", label: "SRM KTR / Kattankulathur" },
  { value: "RAMAPURAM", label: "SRM Ramapuram" },
  { value: "VADAPALANI", label: "SRM Vadapalani" },
  { value: "OTHER_SRM", label: "Other SRM Campus" },
] as const;

export const SRM_AFFILIATIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "STAFF", label: "Staff" },
  { value: "ALUMNI", label: "Alumni" },
] as const;

export const EXTERNAL_AFFILIATIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "STAFF", label: "Staff" },
] as const;

export const ALL_AFFILIATIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "STAFF", label: "Staff" },
  { value: "ALUMNI", label: "Alumni" },
  { value: "GUEST", label: "Guest" },
] as const;

export const categoryLabel = (c: EventCategory) => EVENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const participantLabel = (c: ParticipantCategory) =>
  PARTICIPANT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const institutionTypeLabel = (type: string) =>
  INSTITUTION_TYPES.find((x) => x.value === type)?.label ?? type;
export const campusLabel = (campus?: string | null) =>
  SRM_CAMPUSES.find((x) => x.value === campus)?.label ?? campus ?? "";
export const affiliationLabel = (affil: string) =>
  ALL_AFFILIATIONS.find((x) => x.value === affil)?.label ?? affil;

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

/** Platform-wide cap: one person can hold at most this many tickets for any single event. */
export const MAX_TICKETS_PER_PERSON = 4;
