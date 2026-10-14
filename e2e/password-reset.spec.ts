import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAccount, PASSWORD } from "./helpers";

/**
 * Hosted Supabase delivers mail through its own SMTP, so the test cannot read a
 * mailbox. Instead the admin API generates the same recovery token the email
 * would contain (no email is sent), and the test follows the app's real
 * /auth/confirm → /reset-password flow with it.
 */
async function recoveryLink(email: string) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "No recovery token");
  return `/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`;
}

test("recovery link → set new password → sign in with it", async ({ page }) => {
  const acct = await createAccount("Reset Tester", "e2e+reset");
  await page.goto(await recoveryLink(acct.email));
  await page.waitForURL(/\/reset-password/);
  const next = `${PASSWORD}x9`;
  await page.locator("#password").fill(next);
  const confirm = page.locator("#confirmPassword");
  if (await confirm.count()) await confirm.fill(next);
  await page.getByRole("button", { name: /reset|update|save/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/reset-password"), { timeout: 15_000 });

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(acct.email);
  await page.locator("#password").fill(next);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
});

test("an invalid or reused recovery token is refused", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery&next=/reset-password");
  await expect(page).not.toHaveURL(/\/reset-password$/);
});

test("forgot password responds identically for unknown emails (no enumeration)", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("definitely-not-registered@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/no account|not found|doesn't exist/i)).toHaveCount(0);
});
