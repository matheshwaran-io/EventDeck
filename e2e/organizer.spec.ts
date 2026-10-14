import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";


test("organizer creates, publishes, edits and unpublishes an event", async ({ page }) => {
  const title = `E2E Design Sprint ${Date.now().toString().slice(-5)}`;
  await signIn(page, "organizer@eventdeck.test", "/organizer/events/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("One-line summary").fill("A one-day design sprint for student teams.");
  await page.getByLabel("Venue").fill("Design Studio 4");
  await page.getByLabel("Name").first().fill("Standard");
  await page.getByLabel("Price (₹)").first().fill("99");
  await page.getByLabel("Capacity").first().fill("25");
  await page.getByRole("button", { name: "Add tier" }).click();
  await page.getByLabel("Name").nth(1).fill("VIP");
  await page.getByLabel("Price (₹)").nth(1).fill("299");
  await page.getByLabel("Capacity").nth(1).fill("5");
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.waitForURL(/\/organizer\/events\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  await page.goto("/events?q=" + encodeURIComponent("design sprint"));
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  // Validation: end before start is rejected inline.
  await page.goBack();
  const [row] = await sql`select id from events where title = ${title}`;
  await page.goto(`/organizer/events/${row!.id}/edit`);
  await page.getByLabel("Venue").fill("Design Studio 5");
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText("Changes saved.")).toBeVisible();

  await page.getByRole("button", { name: "Unpublish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByText(/Event unpublished/)).toBeVisible();
  const [after] = await sql`select status, venue from events where id = ${row!.id}`;
  expect(after).toMatchObject({ status: "draft", venue: "Design Studio 5" });
});

test("scanner: manual check-in succeeds once, then reports already used", async ({ page }) => {
  // Fixture: an approved free ticket for an event whose check-in window is open now.
  const [org] = await sql`select id from profiles where email = 'organizer@eventdeck.test'`;
  const [guest] = await sql`select id from profiles where email = 'guest@eventdeck.test'`;
  const tag = randomUUID().slice(0, 4).toUpperCase();
  const [ev] = await sql`
    insert into events (slug, organizer_id, title, summary, venue, start_at, end_at, registration_closes_at, checkin_opens_at, checkin_closes_at, status, published_at)
    values (${"e2e-scan-" + tag.toLowerCase()}, ${org!.id}, ${"E2E Scan Night " + tag}, 'Scanner fixture', 'Hall', now() + interval '1 hour', now() + interval '3 hours',
            now() + interval '30 minutes', now() - interval '1 hour', now() + interval '3 hours', 'published', now()) returning id`;
  const [tier] = await sql`insert into ticket_tiers (event_id, name, price_paise, capacity, allocated) values (${ev!.id}, 'Entry', 0, 10, 1) returning id`;
  const [bk] = await sql`insert into bookings (reference, event_id, user_id, kind, status, payment_status, quantity, amount_paise, attendee_names, idempotency_key)
    values (${"BK-SCAN" + tag}, ${ev!.id}, ${guest!.id}, 'free', 'approved', 'not_required', 1, 0, ARRAY['Daniel Thomas'], ${randomUUID()}) returning id`;
  await sql`insert into booking_items (booking_id, tier_id, quantity, unit_price_paise) values (${bk!.id}, ${tier!.id}, 1, 0)`;
  const number = `ESN-${tag}-AAAA`;
  await sql`insert into tickets (booking_id, event_id, tier_id, seq, ticket_number, qr_token, attendee_name) values (${bk!.id}, ${ev!.id}, ${tier!.id}, 1, ${number}, ${randomUUID().replace(/-/g, "")}, 'Daniel Thomas')`;

  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${ev!.id}/scan`);
  await page.getByLabel("Ticket number").fill(number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Welcome in")).toBeVisible();
  await expect(page.getByText("Daniel Thomas").first()).toBeVisible();
  await page.getByText("Tap to continue").click();
  await page.getByLabel("Ticket number").fill(number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Already checked in")).toBeVisible();

  await page.getByText("Tap to continue").click();
  await page.getByLabel("Ticket number").fill("ZZZ-AAAA-BBBB");
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Not valid")).toBeVisible();
  const [{ n }] = await sql`select count(*)::int as n from check_ins where event_id = ${ev!.id}`;
  expect(n).toBe(1);
});
