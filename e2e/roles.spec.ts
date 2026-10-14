import { expect, test } from "@playwright/test";
import { signIn, signUp, sql } from "./helpers";


test("public signup creates a participant who cannot reach organizer or admin tools", async ({ page }) => {
  const email = await signUp(page);
  const [p] = await sql`select role from profiles where email = ${email}`;
  expect(p!.role).toBe("participant");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.goto("/organizer");
  await expect(page).toHaveURL(/\/forbidden/);
  expect((await page.request.get("/api/reports/bookings")).status()).toBe(403);
  const ev = await sql`select id from events limit 1`;
  const scan = await page.request.post("/api/checkin", { data: { eventId: ev[0]!.id, code: "EVD1:x", method: "manual" } });
  expect(scan.status()).toBe(403);
});

test("organizers cannot manage someone else's event", async ({ page }) => {
  await signIn(page, "cultural@eventdeck.test", "/organizer");
  const [other] = await sql`select e.id from events e join profiles p on p.id = e.organizer_id where p.email = 'organizer@eventdeck.test' limit 1`;
  const res = await page.goto(`/organizer/events/${other!.id}`);
  expect(res?.status()).toBe(404);
  const csv = await page.request.get(`/api/reports/attendance?eventId=${other!.id}`);
  expect(csv.status()).toBe(403);
});

test("organizer application → admin approval grants organizer access", async ({ page }) => {
  const email = await signUp(page);
  await page.goto("/my/profile");
  await page.getByLabel("Club, department or society").fill("E2E Robotics Society");
  await page.getByLabel("What events will you run?").fill("Monthly build nights and an end-of-semester robot showcase.");
  await page.getByRole("button", { name: "Apply for organizer access" }).click();
  await expect(page.getByText("Application under review")).toBeVisible();

  await signIn(page, "admin@eventdeck.test", "/admin/users?tab=applications");
  const card = page.locator("li", { hasText: "E2E Robotics Society" }).first();
  await card.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve organizer" }).click();
  await expect(page.getByText("Organizer approved.")).toBeVisible();
  const [p] = await sql`select role from profiles where email = ${email}`;
  expect(p!.role).toBe("organizer");
});
