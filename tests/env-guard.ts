import { existsSync } from "node:fs";
import { config } from "dotenv";

/**
 * Automated tests run against a hosted **Supabase test project** configured in
 * `.env.test` (see `.env.test.example`). There is no local/Docker database.
 *
 * Safety rules enforced here, before any test touches a database:
 *  1. `.env.test` must exist and define its own Supabase URL + Postgres URL.
 *  2. The database must be a Supabase host (no silent localhost/other fallback).
 *  3. It must NOT be the primary project from `.env.local`, unless the owner
 *     explicitly opts in to isolated-test-data mode with
 *     `ALLOW_TESTS_ON_PRIMARY_PROJECT=true` (fixtures are unique and self-cleaning,
 *     but they still write to that project).
 */
export function loadTestEnv(runner: string) {
  if (!existsSync(".env.test")) {
    throw new Error(`[${runner}] Missing .env.test — copy .env.test.example and fill in a dedicated Supabase TEST project.`);
  }
  const primary = config({ path: ".env.local", processEnv: {} }).parsed ?? {};
  config({ path: ".env.test", override: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dbUrl = process.env.DATABASE_URL ?? "";
  const ref = projectRef(url);
  if (!ref) throw new Error(`[${runner}] NEXT_PUBLIC_SUPABASE_URL in .env.test must be a hosted Supabase project URL (https://<ref>.supabase.co).`);
  if (!/@[^/]*(supabase\.co|supabase\.com)(:\d+)?\//.test(dbUrl)) {
    throw new Error(`[${runner}] DATABASE_URL in .env.test must point at Supabase Postgres (…supabase.co / …pooler.supabase.com).`);
  }
  if (!dbUrl.includes(ref)) {
    throw new Error(`[${runner}] DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL in .env.test refer to different Supabase projects.`);
  }
  const primaryRef = projectRef(primary.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (primaryRef && primaryRef === ref && process.env.ALLOW_TESTS_ON_PRIMARY_PROJECT !== "true") {
    throw new Error(
      `[${runner}] .env.test points at the primary project (${ref}). Use a dedicated Supabase test project, ` +
        "or set ALLOW_TESTS_ON_PRIMARY_PROJECT=true in .env.test to accept isolated test data in it.",
    );
  }
  return { ref, sharedWithPrimary: primaryRef === ref };
}

function projectRef(url: string) {
  return url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/)?.[1] ?? null;
}
