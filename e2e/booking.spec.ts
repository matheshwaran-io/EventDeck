import { expect, test } from "@playwright/test";
import { eventSlug, signIn, signUp, sql } from "./helpers";


test("paid multi-ticket booking → simulated payment → organizer approval → QR tickets + PDF", async ({ page }) => {
  const email = await signUp(page);
  const ev = await eventSlug("Football Cup");
  await page.goto(`/events/${ev.slug}`);
  await page.getByRole("button", { name: "Add one Stands" }).click();
  await page.getByRole("button", { name: "Add one Stands" }).click();
  await page.getByRole("button", { name: "Add one Pavilion" }).click();
  await page.getByRole("button", { name: /Reserve & pay ₹247/ }).click();

  await page.waitForURL(/\/my\/bookings\//);
  const bookingId = page.url().split("/").pop()!;
  await expect(page.getByText("Seats held for you")).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();

  // Simulated decline first, then retry successfully.
  await page.getByRole("button", { name: "Pay ₹247" }).click();
  await page.getByRole("button", { name: "Simulate decline" }).click();
  await expect(page.getByText(/last payment attempt didn/)).toBeVisible();
  await page.getByRole("button", { name: "Pay ₹247" }).click();
  await page.getByRole("button", { name: "Simulate success" }).click();
  await expect(page.getByText("Waiting for organizer verification")).toBeVisible();
  expect((await page.request.get(`/api/tickets/${bookingId}/pdf`)).status()).toBe(409); // not valid yet

  const [{ reference }] = await sql`select reference from bookings where id = ${bookingId}`;
  await signIn(page, "cultural@eventdeck.test", `/organizer/events/${ev.id}/bookings`);
  const row = page.locator("li", { hasText: reference as string });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`${reference}: Approved — tickets issued.`)).toBeVisible();

  await signIn(page, email, `/my/bookings/${bookingId}`);
  await expect(page.getByRole("img", { name: /QR code for ticket/ })).toHaveCount(3);
  const pdf = await page.request.get(`/api/tickets/${bookingId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Nobody else can download these tickets.
  await signIn(page, "guest@eventdeck.test", "/my/bookings");
  expect((await page.request.get(`/api/tickets/${bookingId}/pdf`)).status()).toBe(404);
});

test("free registration needs approval; organizer rejection is explained", async ({ page }) => {
  const email = await signUp(page);
  const ev = await eventSlug("Research Day");
  await page.goto(`/events/${ev.slug}`);
  await page.getByRole("button", { name: "Add one General admission" }).click();
  await page.getByRole("button", { name: "Request registration" }).click();
  await page.waitForURL(/\/my\/bookings\//);
  await expect(page.getByText("Waiting for organizer verification")).toBeVisible();
  const bookingId = page.url().split("/").pop()!;
  const [{ reference }] = await sql`select reference from bookings where id = ${bookingId}`;

  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${ev.id}/bookings`);
  const row = page.locator("li", { hasText: reference as string });
  await row.getByRole("button", { name: "Reject" }).click();
  await page.getByLabel("Reason (shared with the participant)").fill("Venue capacity reserved for presenters");
  await page.getByRole("button", { name: "Reject booking" }).click();
  await expect(page.getByText(`${reference}: Booking rejected.`)).toBeVisible();

  await signIn(page, email, `/my/bookings/${bookingId}`);
  await expect(page.getByText("Venue capacity reserved for presenters")).toBeVisible();
});

test("participant can cancel an unpaid hold and the seats are released", async ({ page }) => {
  await signUp(page);
  const ev = await eventSlug("Midnight Film Club");
  const before = await sql`select allocated from ticket_tiers where event_id = ${ev.id}`;
  await page.goto(`/events/${ev.slug}`);
  await page.getByRole("button", { name: "Add one Screening" }).click();
  await page.getByRole("button", { name: /Reserve & pay/ }).click();
  await page.waitForURL(/\/my\/bookings\//);
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.locator("#main").getByText("Booking cancelled", { exact: true })).toBeVisible();
  const after = await sql`select allocated from ticket_tiers where event_id = ${ev.id}`;
  expect(after[0]!.allocated).toBe(before[0]!.allocated);
});
