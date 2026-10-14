CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."booking_kind" AS ENUM('paid', 'free', 'complimentary');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('awaiting_payment', 'pending_verification', 'approved', 'rejected', 'cancelled', 'expired', 'event_cancelled', 'payment_exception');--> statement-breakpoint
CREATE TYPE "public"."cancellation_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('technical', 'cultural', 'academic', 'workshop', 'sports', 'career', 'social', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('public', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."participant_category" AS ENUM('host_student', 'external_student', 'faculty', 'staff', 'alumni', 'guest');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('created', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_required', 'pending', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('not_applicable', 'pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('valid', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('participant', 'organizer', 'admin');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"event_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	CONSTRAINT "booking_items_quantity_pos" CHECK ("booking_items"."quantity" > 0),
	CONSTRAINT "booking_items_price_nonneg" CHECK ("booking_items"."unit_price_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "booking_kind" NOT NULL,
	"status" "booking_status" NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"refund_status" "refund_status" DEFAULT 'not_applicable' NOT NULL,
	"quantity" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"attendee_names" text[] NOT NULL,
	"pass_reason" text,
	"expires_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"cancelled_at" timestamp with time zone,
	"exception_reason" text,
	"exception_resolved_at" timestamp with time zone,
	"exception_resolved_by" uuid,
	"exception_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_quantity_range" CHECK ("bookings"."quantity" between 1 and 10),
	CONSTRAINT "bookings_amount_nonneg" CHECK ("bookings"."amount_paise" >= 0),
	CONSTRAINT "bookings_attendees_match" CHECK (cardinality("bookings"."attendee_names") = "bookings"."quantity"),
	CONSTRAINT "bookings_hold_has_expiry" CHECK ("bookings"."status" <> 'awaiting_payment' or "bookings"."expires_at" is not null),
	CONSTRAINT "bookings_paid_kind_payment" CHECK (("bookings"."kind" = 'paid') = ("bookings"."payment_status" <> 'not_required'))
);
--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "cancellation_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"scanned_by" uuid NOT NULL,
	"method" text DEFAULT 'qr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_ins_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "event_category" DEFAULT 'other' NOT NULL,
	"venue" text NOT NULL,
	"poster_path" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"registration_closes_at" timestamp with time zone NOT NULL,
	"checkin_opens_at" timestamp with time zone NOT NULL,
	"checkin_closes_at" timestamp with time zone NOT NULL,
	"visibility" "event_visibility" DEFAULT 'public' NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"max_tickets_per_booking" integer DEFAULT 4 NOT NULL,
	"eligible_categories" "participant_category"[] DEFAULT '{host_student,external_student,faculty,staff,alumni,guest}'::participant_category[] NOT NULL,
	"allow_pass_requests" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"admin_note" text,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B') || setweight(to_tsvector('english', coalesce(venue, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_title_len" CHECK (char_length("events"."title") between 3 and 120),
	CONSTRAINT "events_time_order" CHECK ("events"."end_at" > "events"."start_at"),
	CONSTRAINT "events_registration_before_end" CHECK ("events"."registration_closes_at" <= "events"."end_at"),
	CONSTRAINT "events_checkin_order" CHECK ("events"."checkin_closes_at" > "events"."checkin_opens_at"),
	CONSTRAINT "events_max_per_booking" CHECK ("events"."max_tickets_per_booking" between 1 and 10),
	CONSTRAINT "events_eligible_nonempty" CHECK (cardinality("events"."eligible_categories") > 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization" text NOT NULL,
	"reason" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text,
	"amount_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'created' NOT NULL,
	"signature_verified" boolean DEFAULT false NOT NULL,
	"confirmed_via" text,
	"failure_reason" text,
	"flag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payments_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "payments_amount_pos" CHECK ("payments"."amount_paise" > 0),
	CONSTRAINT "payments_provider" CHECK ("payments"."provider" in ('razorpay', 'mock'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'participant' NOT NULL,
	"category" "participant_category" DEFAULT 'host_student' NOT NULL,
	"institution" text,
	"department" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_full_name_len" CHECK (char_length("profiles"."full_name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"provider_refund_id" text,
	"reason" text NOT NULL,
	"failure_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "refunds_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "refunds_provider_refund_id_unique" UNIQUE("provider_refund_id"),
	CONSTRAINT "refunds_amount_pos" CHECK ("refunds"."amount_paise" > 0),
	CONSTRAINT "refunds_status_valid" CHECK ("refunds"."status" <> 'not_applicable')
);
--> statement-breakpoint
CREATE TABLE "ticket_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_paise" integer NOT NULL,
	"capacity" integer NOT NULL,
	"allocated" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_tiers_price_range" CHECK ("ticket_tiers"."price_paise" between 0 and 10000000),
	CONSTRAINT "ticket_tiers_capacity_range" CHECK ("ticket_tiers"."capacity" between 1 and 100000),
	CONSTRAINT "ticket_tiers_allocation" CHECK ("ticket_tiers"."allocated" >= 0 and "ticket_tiers"."allocated" <= "ticket_tiers"."capacity")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ticket_number" text NOT NULL,
	"qr_token" text NOT NULL,
	"attendee_name" text NOT NULL,
	"status" "ticket_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number"),
	CONSTRAINT "tickets_qr_token_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_exception_resolved_by_profiles_id_fk" FOREIGN KEY ("exception_resolved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_scanned_by_profiles_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_profiles_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tier_id_ticket_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."ticket_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_event_idx" ON "audit_logs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_booking_tier_key" ON "booking_items" USING btree ("booking_id","tier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idempotency_key" ON "bookings" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bookings_event_status_idx" ON "bookings" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_hold_expiry_idx" ON "bookings" USING btree ("expires_at") WHERE "bookings"."status" = 'awaiting_payment';--> statement-breakpoint
CREATE UNIQUE INDEX "cancellation_requests_one_pending" ON "cancellation_requests" USING btree ("event_id") WHERE "cancellation_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "cancellation_requests_status_idx" ON "cancellation_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "check_ins_event_idx" ON "check_ins" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "events_listing_idx" ON "events" USING btree ("status","visibility","start_at");--> statement-breakpoint
CREATE INDEX "events_organizer_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_search_idx" ON "events" USING gin ("search");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_applications_one_pending" ON "organizer_applications" USING btree ("user_id") WHERE "organizer_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organizer_applications_status_idx" ON "organizer_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_tiers_event_name_key" ON "ticket_tiers" USING btree ("event_id",lower("name"));--> statement-breakpoint
CREATE INDEX "ticket_tiers_event_idx" ON "ticket_tiers" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_booking_seq_key" ON "tickets" USING btree ("booking_id","seq");--> statement-breakpoint
CREATE INDEX "tickets_event_idx" ON "tickets" USING btree ("event_id");