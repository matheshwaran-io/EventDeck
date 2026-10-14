import { expect, test } from "@playwright/test";
import { createAccount, scanFixture, signIn, sql } from "./helpers";

test("organizer assigns four moderators; moderators scan; revoked moderator is denied", async ({ browser, page }) => {
  const fx = await scanFixture(3);
  const other = await scanFixture(1);
  const mods = await Promise.all(["Asha Moderator", "Bala Moderator", "Chitra Moderator", "Dev Moderator"].map((n) => createAccount(n)));

  // ── Organizer assigns four friends ───────────────────────────────────────
  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${fx.eventId}/team`);
  await expect(page.getByText("No moderators yet")).toBeVisible();
  for (const m of mods) {
    await page.getByLabel("Moderator's account email").fill(m.email);
    await page.getByRole("button", { name: "Add moderator" }).click();
    await expect(page.getByText(`${m.name} can now scan tickets for this event.`)).toBeVisible();
  }
  await expect(page.getByText("4 of 10 active")).toBeVisible();
  await page.getByLabel("Moderator's account email").fill(mods[0]!.email);
  await page.getByRole("button", { name: "Add moderator" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already a moderator" })).toBeVisible();
  await page.getByLabel("Moderator's account email").fill("not-registered-anywhere@example.com");
  await page.getByRole("button", { name: "Add moderator" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No EventDeck account" })).toBeVisible();

  // ── Moderator A logs in, finds the event, checks in a guest ──────────────
  const a = mods[0]!;
  await signIn(page, a.email, "/moderate");
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Check-in" })).toBeVisible();
  await expect(page.getByText(fx.title)).toBeVisible();
  await expect(page.getByText(other.title)).toHaveCount(0); // only assigned events listed
  await page.getByRole("link", { name: new RegExp(fx.title) }).click();
  await expect(page.getByText("Moderator scanner")).toBeVisible();
  await page.getByLabel("Ticket number").fill(fx.tickets[0]!.number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Welcome in")).toBeVisible();
  await expect(page.getByText(fx.tickets[0]!.name).first()).toBeVisible();
  await page.getByText("Tap to continue").click();
  await page.getByLabel("Ticket number").fill(fx.tickets[0]!.number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Already checked in")).toBeVisible();
  await expect(page.getByText(/by Asha Moderator/)).toBeVisible();

  // Ticket from another event is refused in this event's scanner.
  await page.getByText("Tap to continue").click();
  await page.getByLabel("Ticket number").fill(other.tickets[0]!.number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("This ticket is for a different event.").first()).toBeVisible();

  // No organizer powers, no access to unassigned events (UI or API).
  await page.goto(`/organizer/events/${fx.eventId}`);
  await expect(page).toHaveURL(/\/forbidden/);
  expect((await page.goto(`/moderate/${other.eventId}`))?.status()).toBe(404);
  const denied = await page.request.post("/api/checkin", { data: { eventId: other.eventId, code: other.tickets[0]!.number, method: "manual" } });
  expect(denied.status()).toBe(403);
  expect((await page.request.get(`/api/reports/attendance?eventId=${fx.eventId}`)).status()).toBe(403);

  // ── Moderators B and C scan the same ticket at the same moment ──────────
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const pb = await ctxB.newPage();
  const pc = await ctxC.newPage();
  await signIn(pb, mods[1]!.email, "/moderate");
  await signIn(pc, mods[2]!.email, "/moderate");
  const body = { eventId: fx.eventId, code: fx.tickets[1]!.number, method: "manual" };
  const [rb, rc] = await Promise.all([pb.request.post("/api/checkin", { data: body }), pc.request.post("/api/checkin", { data: body })]);
  const statuses = [(await rb.json()).status, (await rc.json()).status].sort();
  expect(statuses).toEqual(["already_used", "checked_in"]);
  await ctxB.close();
  await ctxC.close();

  // ── Organizer revokes moderator D; D is refused immediately ──────────────
  const d = mods[3]!;
  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${fx.eventId}/team`);
  const row = page.locator("li", { hasText: d.email });
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove access" }).click();
  await expect(page.getByText("Access revoked")).toBeVisible();
  await expect(row.getByText("Removed", { exact: true })).toBeVisible();

  await signIn(page, d.email, "/moderate");
  await expect(page.getByText("No check-in assignments")).toBeVisible();
  expect((await page.goto(`/moderate/${fx.eventId}`))?.status()).toBe(404);
  const revoked = await page.request.post("/api/checkin", { data: { eventId: fx.eventId, code: fx.tickets[2]!.number, method: "manual" } });
  expect(revoked.status()).toBe(403);

  // ── Organizer sees attributed check-ins in attendance and the export ────
  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${fx.eventId}/attendance`);
  await expect(page.getByRole("meter").first()).toHaveAttribute("aria-valuenow", "2");
  await expect(page.getByRole("meter").first()).toHaveAttribute("aria-valuemax", "3");
  await expect(page.getByText("by Asha Moderator")).toBeVisible();
  const csv = await page.request.get(`/api/reports/attendance?eventId=${fx.eventId}`);
  expect(await csv.text()).toContain("Asha Moderator");
  const [{ n }] = await sql`select count(*)::int as n from check_ins where event_id = ${fx.eventId}`;
  expect(n).toBe(2);
});
