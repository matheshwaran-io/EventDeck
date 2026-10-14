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

export type SignupIdentity =
  | { kind: "guest" }
  | { kind: "srm"; campus: "KTR" | "RAMAPURAM" | "VADAPALANI" | "OTHER_SRM"; affiliation?: "STUDENT" | "FACULTY" | "STAFF" | "ALUMNI" }
  | { kind: "external"; institution: string; city: string; affiliation?: "STUDENT" | "FACULTY" | "STAFF" };

/** Walks the four-step signup wizard (account → origin → affiliation → review). */
export async function signUp(page: Page, who: SignupIdentity = { kind: "guest" }) {
  await page.context().clearCookies();
  const tag = randomUUID().slice(0, 8);
  const email = who.kind === "srm" ? `e2e+${tag}@srmist.edu.in` : `e2e+${tag}@eventdeck.test`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirmPassword").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const origin = who.kind === "srm" ? /SRM University/ : who.kind === "external" ? /Other College/ : /^Guest/;
  await page.getByRole("button", { name: origin }).first().click();
  if (who.kind === "srm") {
    await page.getByLabel("SRM Campus").selectOption(who.campus);
    await page.getByLabel("You are a").selectOption(who.affiliation ?? "STUDENT");
  } else if (who.kind === "external") {
    await page.getByLabel(/Institution \/ College/).fill(who.institution);
    await page.getByLabel("City").fill(who.city);
    await page.getByLabel("You are a").selectOption(who.affiliation ?? "STUDENT");
  }
  await page.getByRole("button", { name: /Review details/ }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20_000 });
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

/** Test project only: create a confirmed account via the Supabase admin API (no email is sent). */
export async function createAccount(name: string, emailPrefix = "e2e+mod") {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${emailPrefix}-${randomUUID().slice(0, 8)}@eventdeck.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, institution_type: "GUEST" },
  });
  if (error) throw new Error(error.message);
  return { id: data.user!.id, email, name };
}

/** Fixture: a published event owned by organizer@eventdeck.test, check-in open now, with one approved booking of `qty` tickets. */
export async function scanFixture(qty: number, opts: { token?: string; title?: string } = {}) {
  const [org] = await sql`select id from profiles where email = 'organizer@eventdeck.test'`;
  const [buyer] = await sql`select id from profiles where email = 'guest@eventdeck.test'`;
  const tag = randomUUID().slice(0, 4).toUpperCase();
  const title = opts.title ?? `E2E Moderated Gala ${tag}`;
  const [ev] = await sql`
    insert into events (slug, organizer_id, title, summary, venue, start_at, end_at, registration_closes_at, checkin_opens_at, checkin_closes_at, status, published_at)
    values (${"e2e-mod-" + tag.toLowerCase()}, ${org!.id}, ${title}, 'Moderator fixture event', 'Main Gate', now() + interval '1 hour', now() + interval '4 hours',
            now() + interval '30 minutes', now() - interval '1 hour', now() + interval '4 hours', 'published', now()) returning id, title`;
  const [tier] = await sql`insert into ticket_tiers (event_id, name, price_paise, capacity, allocated) values (${ev!.id}, 'Entry', 0, 50, ${qty}) returning id`;
  const names = Array.from({ length: qty }, (_, i) => `Guest ${tag} ${i + 1}`);
  const [bk] = await sql`insert into bookings (reference, event_id, user_id, kind, status, payment_status, quantity, amount_paise, attendee_names, idempotency_key)
    values (${"BK-MOD" + tag}, ${ev!.id}, ${buyer!.id}, 'free', 'approved', 'not_required', ${qty}, 0, ${names}, ${randomUUID()}) returning id`;
  await sql`insert into booking_items (booking_id, tier_id, quantity, unit_price_paise) values (${bk!.id}, ${tier!.id}, ${qty}, 0)`;
  const tickets: { number: string; token: string; name: string }[] = [];
  for (let i = 0; i < qty; i++) {
    const token = i === 0 && opts.token ? opts.token : randomUUID().replace(/-/g, "");
    const number = `EMG-${tag}-${String(i).padStart(4, "A")}`;
    await sql`insert into tickets (booking_id, event_id, tier_id, seq, ticket_number, qr_token, attendee_name) values (${bk!.id}, ${ev!.id}, ${tier!.id}, ${i + 1}, ${number}, ${token}, ${names[i]!})`;
    tickets.push({ number, token, name: names[i]! });
  }
  return { eventId: ev!.id as string, title: ev!.title as string, tickets };
}
