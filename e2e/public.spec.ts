import { expect, test } from "@playwright/test";
import { eventSlug } from "./helpers";


test("home and discovery work against real data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Everything happening on campus");
  await page.getByLabel("Search events").first().fill("hackathon build");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/events\?q=/);
  await expect(page.getByRole("link", { name: /HackNorth 2026/ })).toBeVisible();

  await page.goto("/events?category=sports");
  await expect(page.getByRole("heading", { name: /Inter-College Football Cup/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /HackNorth/ })).toHaveCount(0);

  await page.goto("/events?q=zzzzqqq");
  await expect(page.getByText("No events match")).toBeVisible();
});

test("drafts and unlisted events stay out of listings; unlisted works by link", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: /Faculty Senate/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Robotics Society/ })).toHaveCount(0);
  const unlisted = await eventSlug("Faculty Senate");
  await page.goto(`/events/${unlisted.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Faculty Senate Briefing");
  const draft = await eventSlug("Robotics Society");
  const res = await page.goto(`/events/${draft.slug}`);
  expect(res?.status()).toBe(404);
});

test("anonymous visitors are sent to sign in for protected areas and APIs", async ({ page, request }) => {
  for (const path of ["/my/bookings", "/organizer", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  expect((await request.get("/api/reports/users")).status()).toBe(401);
  expect((await request.post("/api/checkin", { data: { eventId: "00000000-0000-4000-8000-000000000000", code: "x", method: "manual" } })).status()).toBe(401);
  expect((await request.post("/api/webhooks/razorpay", { data: "{}", headers: { "x-razorpay-signature": "bad" } })).status()).toBe(401);
});
