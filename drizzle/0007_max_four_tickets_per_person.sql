-- Platform rule: at most 4 tickets per person per event. Existing events above 4 are lowered to 4 first.
UPDATE "events" SET "max_tickets_per_booking" = 4 WHERE "max_tickets_per_booking" > 4;--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_max_per_booking";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_max_per_booking" CHECK ("events"."max_tickets_per_booking" between 1 and 4);