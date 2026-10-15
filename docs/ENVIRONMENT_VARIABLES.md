# Environment Variables

Every environment variable EventDeck reads, derived from the source (`src/`, `scripts/`, `tests/`, `e2e/`, `drizzle.config.ts`, `next.config.ts`, `playwright.config.ts`). Nothing here is invented: if a variable is not in this list, the code does not read it.

- **Public** variables start with `NEXT_PUBLIC_` and are compiled into the JavaScript sent to browsers. Never put a secret in one.
- **Server-only** variables are read only in server code. The modules that use secrets import `server-only`, so a client component that imports them fails the build.
- Local values live in `.env.local` (git-ignored). Copy `.env.example` to create it. Production values live in **Vercel → Project → Settings → Environment Variables**.

## Application

| Variable | Exposure | Required | Purpose | Where to get it |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Public | Recommended | Base URL put into sign-up confirmation and password-reset links (`src/lib/url.ts`). Use `http://localhost:3000` locally. On Vercel production the app always resolves to `https://eventdeck.online` (or custom verified domain), ignoring localhost and temporary `*.vercel.app` domains. | Your local URL or the production domain (`https://eventdeck.online`) |
| `NEXT_PUBLIC_UNIVERSITY_NAME` | Public | Optional | Name shown in the interface. Default: `SRM University, KTR Campus`. | Free text |

## Supabase

| Variable | Exposure | Required | Purpose | Where to get it |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | **Yes** | Project URL used by browser and server Supabase clients and the proxy. | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | **Yes** (or the legacy key below) | Public API key (`sb_publishable_…`). Safe in the browser because Row-Level Security limits what it can read. | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Legacy fallback | Older name for the public key; used only when the publishable key is not set. | Same place (legacy keys tab) |
| `SUPABASE_SECRET_KEY` | **Server-only secret** | **Yes** for posters, ticket PDFs, admin scripts | Service key (`sb_secret_…`) for Storage uploads and `scripts/*`. Bypasses RLS, so never expose it. | Supabase → Project Settings → API Keys → Secret keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** | Legacy fallback | Older name for the secret key; used only when `SUPABASE_SECRET_KEY` is not set. | Legacy keys tab |
| `DATABASE_URL` | **Server-only secret** | **Yes** | PostgreSQL connection used by the app (Drizzle + postgres.js). Use the **transaction pooler** (port 6543). Contains the database password. | Supabase → Connect → Transaction pooler |
| `DIRECT_URL` | **Server-only secret** | Yes for migrations | Connection used by `drizzle-kit` for migrations. Use the **session pooler** (port 5432). Falls back to `DATABASE_URL` if unset. | Supabase → Connect → Session pooler |

## Payments (Razorpay Test Mode)

| Variable | Exposure | Required | Purpose | Where to get it |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Public | For real test-mode checkout | Key id given to Razorpay Checkout in the browser (`rzp_test_…`). | Razorpay Dashboard (Test Mode) → API Keys |
| `RAZORPAY_KEY_ID` | Server-only | For real test-mode checkout | Same key id, used by the server to create orders and refunds. Live keys (`rzp_live_…`) are refused. | Same |
| `RAZORPAY_KEY_SECRET` | **Server-only secret** | For real test-mode checkout | Signs and verifies Checkout responses. | Same |
| `RAZORPAY_WEBHOOK_SECRET` | **Server-only secret** | For webhooks | Verifies `/api/webhooks/razorpay` signatures. | Razorpay → Settings → Webhooks |
| `ALLOW_MOCK_PAYMENTS` | Server-only | Optional | `true` enables the built-in payment simulator when Razorpay keys are blank. Always ignored when `VERCEL_ENV=production`. | Set `true` locally if you have no Razorpay keys |

Without Razorpay keys and with `ALLOW_MOCK_PAYMENTS=false`, free events still work, but paid checkout cannot start.

## Operations

| Variable | Exposure | Required | Purpose |
| --- | --- | --- | --- |
| `CRON_SECRET` | **Server-only secret** | Production | Bearer token required by `/api/cron/expire-holds`. Vercel Cron sends it automatically when the variable is set in the project. Locally, holds still expire lazily without it. |

## Set automatically by the platform (do not add locally)

| Variable | Set by | Used for |
| --- | --- | --- |
| `NODE_ENV` | Next.js | Development vs production behaviour |
| `VERCEL_ENV` | Vercel | `production` forces the canonical URL, disables the payment simulator and makes `/auth/confirm` redirect to the production domain |
| `NEXT_PUBLIC_VERCEL_ENV` | Vercel (system variable exposed to the framework) | Same production check in browser-compiled code |
| `VERCEL_URL` | Vercel | Fallback base URL for preview deployments |

## Local tooling and tests only (never set in Vercel)

| Variable | Used by | Purpose |
| --- | --- | --- |
| `SEED_DEMO_PASSWORD` | `npm run db:seed`, E2E sign-ins | Password given to the fictional demo accounts |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | `npm run admin:create` | Creates or promotes an administrator. Without `ADMIN_PASSWORD`, a random password is printed once. |
| `DSA_ORGANIZER_EMAIL`, `DSA_ORGANIZER_PASSWORD` | `npm run seed:dsa` | Demo organizer for the poster events. The script appends both to the env file itself. |
| `ENV_FILE` | `scripts/*`, `drizzle.config.ts` | Which env file to load (default `.env.local`). Set by the `cloud:*` and `test:db:*` npm scripts. |
| `NEXT_DIST_DIR` | `next.config.ts`, Playwright | Alternative build folder (E2E uses `.next-e2e`) |
| `ALLOW_TESTS_ON_PRIMARY_PROJECT` | `tests/env-guard.ts` | Set to `true` only to accept isolated, self-cleaning test data in the main project. By default tests refuse to run against it. |

Test configuration lives in `.env.test` (template: `.env.test.example`). It must point at a **separate** Supabase project.

## Not environment variables

- **Brevo SMTP credentials** are entered in **Supabase → Authentication → Emails → SMTP Settings**. The app never reads them, and they must not be added to `.env.local` or Vercel.
- **Supabase Site URL and Redirect URLs** are dashboard settings (see [WINDOWS_SETUP_AND_RUN.md §6](WINDOWS_SETUP_AND_RUN.md#6-supabase-setup)).

## Checking for mistakes

- A secret must never start with `NEXT_PUBLIC_`.
- After changing a `NEXT_PUBLIC_` value, restart `npm run dev` or redeploy: these values are compiled in at build time.
- If an exposed key was ever committed or shared, rotate it in the provider's dashboard.
