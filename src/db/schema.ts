import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", ["participant", "organizer", "admin"]);

export const institutionType = pgEnum("institution_type", ["SRM", "EXTERNAL_INSTITUTION", "GUEST"]);
export const campusEnum = pgEnum("campus", ["KTR", "RAMAPURAM", "VADAPALANI", "OTHER_SRM"]);
export const affiliationEnum = pgEnum("affiliation", ["STUDENT", "FACULTY", "STAFF", "ALUMNI", "GUEST"]);

export const participantCategory = pgEnum("participant_category", [
  "host_student",
  "external_student",
  "faculty",
  "staff",
  "alumni",
  "guest",
]);

export const applicationStatus = pgEnum("application_status", ["pending", "approved", "rejected"]);

export const eventCategory = pgEnum("event_category", [
  "technical",
  "cultural",
  "academic",
  "workshop",
  "sports",
  "career",
  "social",
  "other",
]);

export const eventStatus = pgEnum("event_status", ["draft", "published", "cancelled"]);
export const eventVisibility = pgEnum("event_visibility", ["public", "unlisted"]);

export const bookingKind = pgEnum("booking_kind", ["paid", "free", "complimentary"]);

/** Booking lifecycle + organizer verification. */
export const bookingStatus = pgEnum("booking_status", [
  "awaiting_payment",
  "pending_verification",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "event_cancelled",
  "payment_exception",
]);

/** Payment outcome for the booking, independent of verification. */
export const paymentStatus = pgEnum("payment_status", [
  "not_required",
  "pending",
  "paid",
  "failed",
  "expired",
]);

export const refundStatus = pgEnum("refund_status", [
  "not_applicable",
  "pending",
  "processed",
  "failed",
]);

export const ticketStatus = pgEnum("ticket_status", ["valid", "invalidated"]);

export const paymentAttemptStatus = pgEnum("payment_attempt_status", ["created", "paid", "failed"]);

export const cancellationRequestStatus = pgEnum("cancellation_request_status", [
  "pending",
  "approved",
  "rejected",
]);

/* ----------------------------------------------------------------------------
 * Identity
 * ------------------------------------------------------------------------- */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull().default("participant"),
    category: participantCategory("category").notNull().default("host_student"),
    institution: text("institution"),
    institutionType: institutionType("institution_type").notNull().default("SRM"),
    campus: campusEnum("campus"),
    affiliation: affiliationEnum("affiliation").notNull().default("STUDENT"),
    institutionName: text("institution_name"),
    city: text("city"),
    department: text("department"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("profiles_email_key").on(sql`lower(${t.email})`),
    index("profiles_role_idx").on(t.role),
    index("profiles_institution_type_idx").on(t.institutionType),
    index("profiles_campus_idx").on(t.campus),
    index("profiles_affiliation_idx").on(t.affiliation),
    check("profiles_full_name_len", sql`char_length(${t.fullName}) between 1 and 120`),
  ],
);

export const organizerApplications = pgTable(
  "organizer_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    organization: text("organization").notNull(),
    reason: text("reason").notNull(),
    status: applicationStatus("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
    reviewedAt: ts("reviewed_at"),
  },
  (t) => [
    uniqueIndex("organizer_applications_one_pending")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("organizer_applications_status_idx").on(t.status, t.createdAt),
  ],
);

/* ----------------------------------------------------------------------------
 * Events & inventory
 * ------------------------------------------------------------------------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => profiles.id),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    category: eventCategory("category").notNull().default("other"),
    venue: text("venue").notNull(),
    posterPath: text("poster_path"),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at").notNull(),
    registrationClosesAt: ts("registration_closes_at").notNull(),
    checkinOpensAt: ts("checkin_opens_at").notNull(),
    checkinClosesAt: ts("checkin_closes_at").notNull(),
    visibility: eventVisibility("visibility").notNull().default("public"),
    status: eventStatus("status").notNull().default("draft"),
    maxTicketsPerBooking: integer("max_tickets_per_booking").notNull().default(4),
    eligibleCategories: participantCategory("eligible_categories")
      .array()
      .notNull()
      .default(sql`'{host_student,external_student,faculty,staff,alumni,guest}'::participant_category[]`),
    allowPassRequests: boolean("allow_pass_requests").notNull().default(false),
    publishedAt: ts("published_at"),
    cancelledAt: ts("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    adminNote: text("admin_note"),
    search: tsvector("search").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B') || setweight(to_tsvector('english', coalesce(venue, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("events_listing_idx").on(t.status, t.visibility, t.startAt),
    index("events_organizer_idx").on(t.organizerId),
    index("events_search_idx").using("gin", t.search),
    check("events_title_len", sql`char_length(${t.title}) between 3 and 120`),
    check("events_time_order", sql`${t.endAt} > ${t.startAt}`),
    check("events_registration_before_end", sql`${t.registrationClosesAt} <= ${t.endAt}`),
    check("events_checkin_order", sql`${t.checkinClosesAt} > ${t.checkinOpensAt}`),
    check("events_max_per_booking", sql`${t.maxTicketsPerBooking} between 1 and 10`),
    check(
      "events_eligible_nonempty",
      sql`cardinality(${t.eligibleCategories}) > 0`,
    ),
  ],
);

export const ticketTiers = pgTable(
  "ticket_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    pricePaise: integer("price_paise").notNull(),
    capacity: integer("capacity").notNull(),
    /** Seats held by awaiting-payment bookings plus seats committed to live bookings. */
    allocated: integer("allocated").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ticket_tiers_event_name_key").on(t.eventId, sql`lower(${t.name})`),
    index("ticket_tiers_event_idx").on(t.eventId),
    check("ticket_tiers_price_range", sql`${t.pricePaise} between 0 and 10000000`),
    check("ticket_tiers_capacity_range", sql`${t.capacity} between 1 and 100000`),
    check("ticket_tiers_allocation", sql`${t.allocated} >= 0 and ${t.allocated} <= ${t.capacity}`),
  ],
);

/* ----------------------------------------------------------------------------
 * Bookings, tickets, check-ins
 * ------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    kind: bookingKind("kind").notNull(),
    status: bookingStatus("status").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull(),
    refundStatus: refundStatus("refund_status").notNull().default("not_applicable"),
    quantity: integer("quantity").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    attendeeNames: text("attendee_names").array().notNull(),
    passReason: text("pass_reason"),
    expiresAt: ts("expires_at"),
    idempotencyKey: text("idempotency_key").notNull(),
    decidedBy: uuid("decided_by").references(() => profiles.id),
    decidedAt: ts("decided_at"),
    decisionNote: text("decision_note"),
    cancelledAt: ts("cancelled_at"),
    exceptionReason: text("exception_reason"),
    exceptionResolvedAt: ts("exception_resolved_at"),
    exceptionResolvedBy: uuid("exception_resolved_by").references(() => profiles.id),
    exceptionNote: text("exception_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_idempotency_key").on(t.userId, t.idempotencyKey),
    index("bookings_event_status_idx").on(t.eventId, t.status),
    index("bookings_user_idx").on(t.userId, t.createdAt),
    index("bookings_hold_expiry_idx")
      .on(t.expiresAt)
      .where(sql`${t.status} = 'awaiting_payment'`),
    check("bookings_quantity_range", sql`${t.quantity} between 1 and 10`),
    check("bookings_amount_nonneg", sql`${t.amountPaise} >= 0`),
    check("bookings_attendees_match", sql`cardinality(${t.attendeeNames}) = ${t.quantity}`),
    check(
      "bookings_hold_has_expiry",
      sql`${t.status} <> 'awaiting_payment' or ${t.expiresAt} is not null`,
    ),
    check(
      "bookings_paid_kind_payment",
      sql`(${t.kind} = 'paid') = (${t.paymentStatus} <> 'not_required')`,
    ),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => ticketTiers.id),
    quantity: integer("quantity").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
  },
  (t) => [
    uniqueIndex("booking_items_booking_tier_key").on(t.bookingId, t.tierId),
    check("booking_items_quantity_pos", sql`${t.quantity} > 0`),
    check("booking_items_price_nonneg", sql`${t.unitPricePaise} >= 0`),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => ticketTiers.id),
    seq: integer("seq").notNull(),
    ticketNumber: text("ticket_number").notNull().unique(),
    qrToken: text("qr_token").notNull().unique(),
    attendeeName: text("attendee_name").notNull(),
    status: ticketStatus("status").notNull().default("valid"),
    issuedAt: createdAt(),
    invalidatedAt: ts("invalidated_at"),
    invalidationReason: text("invalidation_reason"),
  },
  (t) => [
    uniqueIndex("tickets_booking_seq_key").on(t.bookingId, t.seq),
    index("tickets_event_idx").on(t.eventId),
  ],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .unique()
      .references(() => tickets.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    scannedBy: uuid("scanned_by")
      .notNull()
      .references(() => profiles.id),
    method: text("method").notNull().default("qr"),
    scannedAt: createdAt(),
  },
  (t) => [index("check_ins_event_idx").on(t.eventId, t.scannedAt)],
);

/* ----------------------------------------------------------------------------
 * Payments & refunds
 * ------------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    provider: text("provider").notNull(),
    orderId: text("order_id").notNull().unique(),
    paymentId: text("payment_id").unique(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentAttemptStatus("status").notNull().default("created"),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    confirmedVia: text("confirmed_via"),
    failureReason: text("failure_reason"),
    /** Set when a successful payment could not be applied normally (duplicate, late, etc). */
    flag: text("flag"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    paidAt: ts("paid_at"),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    check("payments_amount_pos", sql`${t.amountPaise} > 0`),
    check("payments_provider", sql`${t.provider} in ('razorpay', 'mock')`),
  ],
);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  outcome: text("outcome"),
  receivedAt: createdAt(),
});

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => bookings.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    amountPaise: integer("amount_paise").notNull(),
    status: refundStatus("status").notNull().default("pending"),
    providerRefundId: text("provider_refund_id").unique(),
    reason: text("reason").notNull(),
    failureReason: text("failure_reason"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    processedAt: ts("processed_at"),
  },
  (t) => [
    index("refunds_status_idx").on(t.status),
    check("refunds_amount_pos", sql`${t.amountPaise} > 0`),
    check("refunds_status_valid", sql`${t.status} <> 'not_applicable'`),
  ],
);

/* ----------------------------------------------------------------------------
 * Operations
 * ------------------------------------------------------------------------- */

export const cancellationRequests = pgTable(
  "cancellation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => profiles.id),
    reason: text("reason").notNull(),
    status: cancellationRequestStatus("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
    reviewedAt: ts("reviewed_at"),
  },
  (t) => [
    uniqueIndex("cancellation_requests_one_pending")
      .on(t.eventId)
      .where(sql`${t.status} = 'pending'`),
    index("cancellation_requests_status_idx").on(t.status, t.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => profiles.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    eventId: uuid("event_id").references(() => events.id),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_event_idx").on(t.eventId, t.createdAt),
    index("audit_logs_action_idx").on(t.action),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Event = typeof events.$inferSelect;
export type TicketTier = typeof ticketTiers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Role = (typeof userRole.enumValues)[number];
export type InstitutionType = (typeof institutionType.enumValues)[number];
export type Campus = (typeof campusEnum.enumValues)[number];
export type Affiliation = (typeof affiliationEnum.enumValues)[number];

export const APPLICATION_ROLES = {
  UNIVERSITY_ADMIN: "admin",
  EVENT_ORGANIZER: "organizer",
  PARTICIPANT: "participant",
} as const;

export type ApplicationRole = keyof typeof APPLICATION_ROLES;

export type ParticipantCategory = (typeof participantCategory.enumValues)[number];
export type EventCategory = (typeof eventCategory.enumValues)[number];
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type RefundStatus = (typeof refundStatus.enumValues)[number];
