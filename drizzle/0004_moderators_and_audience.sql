-- Profile institution columns/enums already exist (0002, hand-written); only new objects here.
CREATE TABLE "event_moderators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "eligible_institution_types" "institution_type"[] DEFAULT '{SRM,EXTERNAL_INSTITUTION,GUEST}'::institution_type[] NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "eligible_campuses" "campus"[] DEFAULT '{KTR,RAMAPURAM,VADAPALANI,OTHER_SRM}'::campus[] NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "eligible_institutions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "event_moderators" ADD CONSTRAINT "event_moderators_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderators" ADD CONSTRAINT "event_moderators_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderators" ADD CONSTRAINT "event_moderators_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_moderators" ADD CONSTRAINT "event_moderators_revoked_by_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_moderators_one_active" ON "event_moderators" USING btree ("event_id","user_id") WHERE "event_moderators"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "event_moderators_user_idx" ON "event_moderators" USING btree ("user_id") WHERE "event_moderators"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "event_moderators_event_idx" ON "event_moderators" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_institution_types_nonempty" CHECK (cardinality("events"."eligible_institution_types") > 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campuses_nonempty" CHECK (cardinality("events"."eligible_campuses") > 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_institutions_max" CHECK (cardinality("events"."eligible_institutions") <= 25);