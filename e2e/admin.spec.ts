import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";


test("admin approves a cancellation: tickets void, refunds processed, audit + CSV available", async ({ page }) => {
  // Fixture: a fresh paid event with an approved paid booking and a pending cancellation request.
  const [org] = await sql`select id from profiles where email = 'organizer@eventdeck.test'`;
  const [buyer] = await sql`select id from profiles where email = 'aditi@eventdeck.test'`;
  const slug = `e2e-cancel-${randomUUID().slice(0, 6)}`;
  const [ev] = await sql`
    insert into events (slug, organizer_id, title, summary, venue, start_at, end_at, registration_closes_at, checkin_opens_at, checkin_closes_at, status, published_at)
    values (${slug}, ${org!.id}, ${"E2E Cancellable Talk " + slug.slice(-6)}, 'Fixture event for cancellation flow', 'Room 1',
      now() + interval '5 days', now() + interval '5 days 2 hours', now() + interval '4 days', now() + interval '5 days' - interval '1 hour', now() + interval '5 days 2 hours', 'published', now())
    returning id, title`;
  const [tier] = await sql`insert into ticket_tiers (event_id, name, price_paise, capacity, allocated) values (${ev!.id}, 'GA', 15000, 10, 1) returning id`;
  const [bk] = await sql`
    insert into bookings (reference, event_id, user_id, kind, status, payment_status, quantity, amount_paise, attendee_names, idempotency_key)
    values (${"BK-E2E" + slug.slice(-4).toUpperCase()}, ${ev!.id}, ${buyer!.id}, 'paid', 'approved', 'paid', 1, 15000, ARRAY['Aditi Nair'], ${randomUUID()}) returning id`;
  await sql`insert into booking_items (booking_id, tier_id, quantity, unit_price_paise) values (${bk!.id}, ${tier!.id}, 1, 15000)`;
  await sql`insert into payments (booking_id, provider, order_id, payment_id, amount_paise, status, signature_verified, paid_at) values (${bk!.id}, 'mock', ${"order_mock_" + slug}, ${"pay_mock_" + slug}, 15000, 'paid', true, now())`;
  await sql`insert into tickets (booking_id, event_id, tier_id, seq, ticket_number, qr_token, attendee_name) values (${bk!.id}, ${ev!.id}, ${tier!.id}, 1, ${"E2E-" + slug.slice(-4).toUpperCase() + "-AAAA"}, ${randomUUID().replace(/-/g, "")}, 'Aditi Nair')`;
  await sql`insert into cancellation_requests (event_id, requested_by, reason) values (${ev!.id}, ${org!.id}, 'Speaker withdrew at short notice — e2e fixture')`;

  await signIn(page, "admin@eventdeck.test", "/admin/cancellations");
  const card = page.locator("li", { hasText: ev!.title as string });
  await card.getByRole("button", { name: "Approve & cancel event" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel event" }).click();
  await expect(page.getByText(/Event cancelled\. 1 booking\(s\) affected, 1 refund\(s\) queued/)).toBeVisible();

  const [t] = await sql`select status from tickets where booking_id = ${bk!.id}`;
  expect(t!.status).toBe("invalidated");

  await page.goto("/admin/refunds?status=pending");
  const refundRow = page.locator("tr", { hasText: ev!.title as string });
  await refundRow.getByRole("button", { name: "Process" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Refund/ }).click();
  await expect(page.getByText("Refund processed (test mode).")).toBeVisible();
  const [b] = await sql`select status, refund_status from bookings where id = ${bk!.id}`;
  expect(b).toMatchObject({ status: "event_cancelled", refund_status: "processed" });

  await page.goto("/admin/audit?action=event");
  await expect(page.getByRole("cell", { name: /cancelled the event/ }).first()).toBeVisible();

  const csv = await page.request.get("/api/reports/refunds");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Booking,Event,Email");
});
