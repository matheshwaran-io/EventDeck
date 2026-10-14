CREATE TYPE "public"."payout_account_status" AS ENUM('unverified', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "organizer_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" text DEFAULT 'bank_account' NOT NULL,
	"beneficiary_name" text NOT NULL,
	"bank_name" text,
	"account_number" text,
	"ifsc_code" text,
	"upi_id" text,
	"status" "payout_account_status" DEFAULT 'verified' NOT NULL,
	"verification_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_payout_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"event_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"platform_fee_paise" integer DEFAULT 0 NOT NULL,
	"net_amount_paise" integer NOT NULL,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"payout_method" text DEFAULT 'bank_transfer' NOT NULL,
	"beneficiary_snapshot" jsonb NOT NULL,
	"utr" text,
	"notes" text,
	"processed_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_reference_unique" UNIQUE("reference"),
	CONSTRAINT "payouts_amount_pos" CHECK ("payouts"."amount_paise" > 0),
	CONSTRAINT "payouts_net_nonneg" CHECK ("payouts"."net_amount_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "organizer_payout_accounts" ADD CONSTRAINT "organizer_payout_accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organizer_id_profiles_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_profiles_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payout_accounts_user_idx" ON "organizer_payout_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payouts_event_idx" ON "payouts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payouts_organizer_idx" ON "payouts" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
ALTER TABLE public.organizer_payout_accounts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.organizer_payout_accounts FROM anon, authenticated;--> statement-breakpoint
CREATE POLICY organizer_payout_accounts_select ON public.organizer_payout_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());--> statement-breakpoint
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payouts FROM anon, authenticated;--> statement-breakpoint
CREATE POLICY payouts_select ON public.payouts FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR public.owns_event(event_id) OR public.is_admin());