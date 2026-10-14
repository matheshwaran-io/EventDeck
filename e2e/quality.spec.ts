import { expect, test, type Page } from "@playwright/test";
import { eventSlug, scanFixture, signIn } from "./helpers";

/** Collect console errors, uncaught exceptions and 5xx responses while visiting pages. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/Download the React DevTools|favicon|WebSocket connection|realtime/i.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
  });
  return problems;
}

const ROLE_PAGES: Record<string, string[]> = {
  "participant@eventdeck.test": ["/", "/events", "/my/bookings", "/my/notifications", "/my/profile"],
  "organizer@eventdeck.test": ["/organizer", "/organizer/events", "/organizer/events/new"],
  "admin@eventdeck.test": ["/admin", "/admin/events", "/admin/users", "/admin/users?tab=applications", "/admin/cancellations", "/admin/refunds", "/admin/exceptions", "/admin/reports", "/admin/audit"],
};

for (const [email, paths] of Object.entries(ROLE_PAGES)) {
  test(`no console errors or server errors across ${email.split("@")[0]} pages`, async ({ page }) => {
    await signIn(page, email, paths[0]);
    const problems = watch(page);
    for (const p of paths) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBeLessThan(400);
      await expect(page.locator("main, #main").first()).toBeVisible();
      await expect(page.getByText("We hit a snag")).toHaveCount(0);
    }
    expect(problems).toEqual([]);
  });
}

test("organizer event sub-pages all load for a seeded event", async ({ page }) => {
  const ev = await eventSlug("HackNorth");
  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${ev.id}`);
  const problems = watch(page);
  for (const sub of ["", "/bookings", "/scan", "/attendance", "/team", "/edit", "/activity"]) {
    const res = await page.goto(`/organizer/events/${ev.id}${sub}`);
    expect(res?.status(), sub).toBe(200);
    await expect(page.getByText("We hit a snag")).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});

test("keyboard: skip link reaches main content and primary nav is tabbable", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(["A", "BUTTON", "INPUT"]).toContain(focused);
});

test("session survives refresh; cleared session redirects protected pages to sign-in", async ({ page }) => {
  await signIn(page, "participant@eventdeck.test", "/my/bookings");
  await page.reload();
  await expect(page.getByRole("heading", { name: "My tickets" })).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/my/bookings");
  await expect(page).toHaveURL(/\/login\?next=%2Fmy%2Fbookings/);
});

test("camera denied: scanner explains recovery and manual entry still validates on the server", async ({ page }) => {
  const fx = await scanFixture(1);
  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${fx.eventId}/scan`);
  await page.getByRole("button", { name: "Start scanning" }).click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/permission was denied|No camera was found|Couldn't start the camera|can't access the camera/)).toBeVisible();
  await page.getByLabel("Ticket number").fill(fx.tickets[0]!.number);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Welcome in")).toBeVisible();
});
