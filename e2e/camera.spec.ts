import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { FAKE_CAMERA_TOKEN } from "./global-setup";
import { createAccount, scanFixture, signIn } from "./helpers";

test("moderator scans a real QR through the (fake) camera feed; re-scan is refused", async ({ page }) => {
  const { token } = JSON.parse(readFileSync(FAKE_CAMERA_TOKEN, "utf8")) as { token: string };
  const fx = await scanFixture(1, { token });
  const mod = await createAccount("Camera Moderator");

  await signIn(page, "organizer@eventdeck.test", `/organizer/events/${fx.eventId}/team`);
  await page.getByLabel("Moderator's account email").fill(mod.email);
  await page.getByRole("button", { name: "Add moderator" }).click();
  await expect(page.getByText(/can now scan tickets/)).toBeVisible();

  await signIn(page, mod.email, `/moderate/${fx.eventId}`);
  await page.getByRole("button", { name: "Start scanning" }).click();
  await expect(page.getByText("Welcome in")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(fx.tickets[0]!.name).first()).toBeVisible();

  // The same QR stays in front of the camera: after the 4s debounce it's re-submitted and refused.
  await expect(page.getByText("Already checked in")).toBeVisible({ timeout: 20_000 });
});
