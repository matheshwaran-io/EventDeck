import { expect, test } from "@playwright/test";
import { signIn, signUp, sql } from "./helpers";

test("organizer publishes a KTR-only event; guest is refused, KTR student registers", async ({ page }) => {
  const title = `E2E KTR Only Meetup ${Date.now().toString().slice(-5)}`;
  await signIn(page, "organizer@eventdeck.test", "/organizer/events/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("One-line summary").fill("A campus-only meetup for KTR students.");
  await page.getByLabel("Venue").fill("Tech Park 401");
  await page.getByLabel("Name").first().fill("Entry");
  await page.getByLabel("Capacity").first().fill("40");
  await page.getByRole("checkbox", { name: /Other colleges/ }).uncheck();
  await page.getByRole("checkbox", { name: /Guests/ }).uncheck();
  for (const c of [/Ramapuram/, /Vadapalani/, /Other SRM Campus/]) await page.getByRole("checkbox", { name: c }).uncheck();
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.waitForURL(/\/organizer\/events\/[0-9a-f-]{36}$/);
  const [ev] = await sql`select slug, eligible_institution_types::text as types, eligible_campuses::text as campuses from events where title = ${title}`;
  expect(ev).toMatchObject({ types: "{SRM}", campuses: "{KTR}" });

  await page.goto(`/events/${ev!.slug}`);
  await expect(page.getByText("SRM KTR only").first()).toBeVisible();
  await page.goto("/events?audience=srm");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto("/events?audience=intercollege");
  await expect(page.getByRole("heading", { name: title })).toHaveCount(0);

  await signUp(page, { kind: "guest" });
  await page.goto(`/events/${ev!.slug}`);
  await expect(page.getByText("This event isn't open to guests.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Request registration/ })).toHaveCount(0);

  await signUp(page, { kind: "srm", campus: "RAMAPURAM" });
  await page.goto(`/events/${ev!.slug}`);
  await expect(page.getByText("This event is limited to SRM KTR.")).toBeVisible();

  await signUp(page, { kind: "srm", campus: "KTR" });
  await page.goto(`/events/${ev!.slug}`);
  await page.getByRole("button", { name: "Add one Entry" }).click();
  await page.getByRole("button", { name: "Request registration" }).click();
  await page.waitForURL(/\/my\/bookings\//);
  await expect(page.getByText("Waiting for organizer verification")).toBeVisible();
});
