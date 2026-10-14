import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

export const PASSWORD = process.env.SEED_DEMO_PASSWORD!;
export const sql = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 5, prepare: false });

export async function signIn(page: Page, email: string, next = "/") {
  await page.context().clearCookies();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function signUp(page: Page) {
  await page.context().clearCookies();
  const email = `e2e+${randomUUID().slice(0, 8)}@eventdeck.test`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/events");
  return email;
}

export async function eventSlug(titleLike: string) {
  const [row] = await sql`select slug, id from events where title ilike ${`%${titleLike}%`} limit 1`;
  if (!row) throw new Error(`No seeded event like ${titleLike}`);
  return row as unknown as { slug: string; id: string };
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
