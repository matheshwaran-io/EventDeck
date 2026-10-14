import { expect, test } from "@playwright/test";
import { eventSlug, noHorizontalScroll, signIn } from "./helpers";


test("critical screens fit phones and tablets without horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  await noHorizontalScroll(page);
  if ((page.viewportSize()?.width ?? 0) < 768) {
    // Phones get the slide-over menu…
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Events" })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    // …tablets and up get the inline primary navigation.
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Events" })).toBeVisible();
  }

  const ev = await eventSlug("Raag");
  await page.goto(`/events/${ev.slug}`);
  await noHorizontalScroll(page);
  await expect(page.getByRole("button", { name: "Add one Gold" })).toBeVisible();

  await signIn(page, "participant@eventdeck.test", "/my/bookings");
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: /Raag & Rhythm/ }).first().click();
  await expect(page.getByRole("img", { name: /QR code for ticket/ }).first()).toBeVisible();
  await noHorizontalScroll(page);

  await signIn(page, "organizer@eventdeck.test", "/organizer");
  await noHorizontalScroll(page);
});
