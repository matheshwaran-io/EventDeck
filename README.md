# EventDeck — University Event Management System

A mobile-first platform for discovering, booking and running university events: configurable ticket tiers, multi-ticket bookings with transactional inventory, Razorpay **Test Mode** payments with server-side verification, organizer verification, QR tickets (PDF), phone-camera check-in, event cancellation with refund tracking, in-app realtime notifications, CSV reports and a full audit trail.

> Payments run in Razorpay **Test Mode only**. Live keys (`rzp_live_…`) are refused by the app and no real money ever moves.

---

## Contents

1. [Features](#features)
2. [Stack](#stack)
3. [Architecture & security model](#architecture--security-model)
4. [Local development](#local-development) · [Windows quick start](#windows-quick-start)
5. [Demo accounts](#demo-accounts)
6. [Razorpay Test Mode](#razorpay-test-mode)
7. [Supabase (cloud) setup](#supabase-cloud-setup)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Provisioning the first administrator](#provisioning-the-first-administrator)
10. [Testing & Functional QA Manual](#testing--functional-qa-manual)
11. [Documentation](#documentation)
12. [Known limitations](#known-limitations)

---

## Features

| Area | What works |
| --- | --- |
| **Discovery** | Landing page, category browsing, PostgreSQL full-text search (prefix matching, ranked) with date / venue / availability / free-entry filters, pagination, public vs **unlisted** (direct-link) events. |
| **Booking** | Event-specific tiers (Silver / Gold / VIP … any names), multi-tier multi-ticket bookings, per-event per-person limits, eligibility by participant category, registration deadline enforced server-side, per-attendee names, idempotent submissions. |
| **Inventory safety** | Atomic `UPDATE … WHERE allocated + n <= capacity`, DB check constraints, sorted multi-tier locking, 10-minute holds released exactly once (lazy expiry on every relevant read + daily cron safety net). |
| **Payments** | Server-created Razorpay orders (server-priced), Checkout signature verification, webhook signature verification + event-id dedupe, idempotent confirmation, retry after failure, late-payment recovery or exception parking, duplicate-payment detection. A local **payment simulator** drives the same code path when keys are absent (never on Vercel production). |
| **Verification** | Free bookings are approved immediately and paid bookings as soon as the payment is verified. Complimentary pass requests (₹0, with an eligibility reason) wait for the organizer to approve or reject them with a note. |
| **Tickets** | One ticket per attendee, unique ticket number, 192-bit random QR token (no personal data, no status in the QR). Access-controlled PDF download (cached in a private Storage bucket). |
| **Check-in** | `html5-qrcode` scanner with permission / insecure-context / no-camera handling, manual ticket-number fallback, server validation (event match, approval, check-in window), atomic duplicate prevention across devices, live session log. |
| **Cancellation & refunds** | Organizer requests → admin approves → event cancelled, new bookings stop, tickets invalidated, attendees notified, refunds queued for paid bookings; refunds processed via Razorpay Test Mode (or simulator), status tracked to participants; webhook updates. |
| **Dashboards** | Participant (upcoming/past, payment, verification, ticket validity, refunds), Organizer (metrics, verification queue, tiers inventory, scanner, attendance, activity log), Admin (metrics, 14-day sales chart, people & organizer applications, event oversight, cancellations, refunds, payment exceptions, reports, audit log). |
| **Notifications** | In-app notifications for every lifecycle event, Supabase Realtime (RLS-filtered) with polling + focus refresh fallback; live booking-page refresh. |
| **Reports** | CSV exports (bookings, attendance, payments, refunds, events, users, audit) from authorised server queries, formula-injection safe, every export audited. |

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · lucide-react · Supabase (Postgres, Auth, Storage, Realtime) · Drizzle ORM + Drizzle Kit · React Hook Form + Zod · Razorpay Checkout (Test Mode) · pdf-lib + qrcode · html5-qrcode · sharp · Vitest · Playwright.

## Architecture & security model

```
Browser ──(Supabase Auth session cookie)──▶ Next.js server (proxy.ts refreshes session)
   │                                           │
   │  anon key + user JWT (read-only, RLS)     │  privileged Postgres connection (Drizzle)
   ▼                                           ▼
Supabase Realtime / PostgREST            src/lib/server/*  ── all writes, transactions, role checks
```

* **All writes** go through server actions / route handlers → `src/lib/server/*` services, which re-validate input (Zod), check role **and ownership**, and run in Postgres transactions.
* **Row Level Security** is enabled on every table (`drizzle/0001_security_rls_realtime.sql`). `anon`/`authenticated` have **no** insert/update/delete privileges at all; SELECT policies expose only a user's own rows (organizers: rows for their events; admins: everything). Drafts and unlisted events are never listable through the API.
* **Roles**: `participant` (default for every signup — a DB trigger ignores any role in signup metadata), `organizer` (granted by an admin), `admin` (provisioned only from the CLI). Participant *category* (student, faculty, guest…) is profile data, not a role.
* **Status model** — four independent fields with explicit transitions (`src/lib/domain/transitions.ts`, enforced by compare-and-set updates):

  | Field | Values |
  | --- | --- |
  | `bookings.status` (lifecycle + verification) | free → `approved`; paid: `awaiting_payment → approved`; pass request: `pending_verification → approved \| rejected`; also `cancelled`, `expired`, `event_cancelled`, `payment_exception` |
  | `bookings.payment_status` | `not_required`, `pending`, `paid`, `failed`, `expired` |
  | `tickets.status` | `valid`, `invalidated` (+ check-in recorded in `check_ins`, unique per ticket) |
  | `bookings.refund_status` / `refunds.status` | `not_applicable`, `pending`, `processed`, `failed` |

  A ticket is valid only when the booking is `approved`, payment is `paid` or `not_required`, and the event isn't cancelled — checked again at PDF download and at every scan.
* **Late payments**: if a verified payment arrives after a hold expired or was cancelled, the server tries to re-allocate the same seats in a savepoint. If seats are gone the booking becomes `payment_exception` (payment kept, admins notified) — a successful payment is never discarded and never silently turned into a ticket.
* **Secrets** (service-role key, DB URL, Razorpay secret, webhook secret) are server-only env vars. Audit-log details pass through a redaction filter; card data is never seen by the app.

## Local development

**Prerequisites:** Node.js 24+, npm, and an active hosted Supabase project. No local Docker or PostgreSQL installation is needed.

```bash
npm install
```

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` (`cp .env.example .env.local` on macOS/Linux, `Copy-Item .env.example .env.local` in Windows PowerShell):
   Fill in your hosted Supabase credentials from your Supabase Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL (`https://<project-ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): Public API key
   - `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): Secret service role key
   - `DATABASE_URL`: Transaction pooler URI (port 6543) for application queries
   - `DIRECT_URL`: Direct connection URI (port 5432) for running DDL migrations
   - Razorpay test keys or `ALLOW_MOCK_PAYMENTS=true` for local testing

2. **Apply Database Migrations**:
   Run Drizzle migrations against your hosted Supabase PostgreSQL database:
   ```bash
   npm run db:migrate
   ```

3. **(Optional) Seed Demo Accounts & Data**:
   Populate demo users and events:
   ```bash
   npm run db:seed
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

Open http://localhost:3000 in your browser. Hosted Supabase Studio is available directly in your Supabase web dashboard.

> Camera access requires a secure context: `localhost` works; on a phone use the HTTPS Vercel deployment (or an HTTPS tunnel).

## Windows quick start

Windows 10/11 with Node.js 24 LTS (20.9+), Git and PowerShell. The npm scripts use `cross-env`, so they run the same in PowerShell and `cmd.exe`. Full step-by-step manual with troubleshooting: **[docs/WINDOWS_SETUP_AND_RUN.md](docs/WINDOWS_SETUP_AND_RUN.md)**.

```powershell
git clone https://github.com/Eventdeck88/EventDeck.git
```

```powershell
Set-Location EventDeck
```

```powershell
npm ci
```

```powershell
Copy-Item .env.example .env.local
```

Fill in `.env.local` ([variable reference](docs/ENVIRONMENT_VARIABLES.md)), then run:

```powershell
npm run verify
```

```powershell
npm run dev
```

Open http://localhost:3000. If PowerShell reports that `npm.ps1` cannot be loaded, use `npm.cmd` instead of `npm` or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Demo accounts

`npm run db:seed` creates these accounts (password = your `SEED_DEMO_PASSWORD`):

| Email | Role | Notes |
| --- | --- | --- |
| `admin@eventdeck.test` | Admin | Pending cancellation request waiting |
| `organizer@eventdeck.test` | Organizer | HackNorth, ML Workshop, Research Day, Orientation Mixer (check-in open now), unlisted + draft events |
| `cultural@eventdeck.test` | Organizer | Raag & Rhythm (Silver/Gold/Diamond), Football Cup, Film Club |
| `participant@eventdeck.test` | Participant | Approved paid + free tickets |
| `guest@eventdeck.test` | Participant (external student) | Approved paid booking, pass request awaiting organizer review |
| `aditi@eventdeck.test` | Participant | Hold awaiting payment, approved paid booking |
| `applicant@eventdeck.test` | Participant | Use to try the organizer application flow |

## Razorpay Test Mode

1. Create a Razorpay account and switch the dashboard to **Test Mode**.
2. **Settings → API Keys → Generate Test Key** → set `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (both `rzp_test_…`) and `RAZORPAY_KEY_SECRET`.
3. **Settings → Webhooks → Add** `https://<your-domain>/api/webhooks/razorpay` with a secret (→ `RAZORPAY_WEBHOOK_SECRET`) and the events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, `refund.failed`.
4. Set `ALLOW_MOCK_PAYMENTS=false`. Pay with Razorpay's published test cards / UPI test IDs.

Refunds for cancelled events are submitted from **Admin → Refunds** to the Razorpay test API; their final state arrives via the `refund.*` webhooks.

## Supabase (cloud) setup

1. Create a project (free tier). Note the database password.
2. **Authentication → Sign In / Providers → Email**: keep email/password enabled. For a quick demo you may turn **Confirm email** *off* (otherwise new users must click the emailed link, which lands on `/auth/confirm`). Authorization does not depend on this setting.
3. **Authentication → URL Configuration**: set the Site URL to your deployed URL and add it to redirect URLs.
4. **Project Settings → API**: copy the URL, anon key and service-role key. **Project Settings → Database → Connection string**: copy the *transaction pooler* URI for `DATABASE_URL` (port 6543) and direct connection URI for `DIRECT_URL` (port 5432).
5. Run the migrations against the cloud database from your machine:

   ```bash
   npm run db:migrate
   ```

   The migrations create all tables, constraints, indexes, the signup trigger, RLS policies, the Realtime publication for `notifications` + `bookings`, and the `posters` (public) / `tickets` (private) Storage buckets.
6. Provision the first admin (below). Optionally seed demo data with `npm run db:seed` using the same env vars.

Never run destructive resets (`supabase db reset`, dropping schemas) against a database that holds real data.

## Deploying to Vercel

1. Import the repository in Vercel (framework: Next.js).
2. Add environment variables (Production + Preview): everything in `.env.example` **except** `SEED_DEMO_PASSWORD`, `ADMIN_*`.
   - Set `NEXT_PUBLIC_APP_URL` to `https://eventdeck.online` for production, and `ALLOW_MOCK_PAYMENTS=false` (the simulator is force-disabled on production regardless).
   - In Supabase Dashboard → **Authentication** → **URL Configuration**:
     - **Site URL**: `https://eventdeck.online`
     - **Redirect URLs**: Add `https://eventdeck.online/**` and `http://localhost:3000/**`.
3. Deploy. `vercel.json` registers a daily cron (`/api/cron/expire-holds`, authorised with `CRON_SECRET`) as a safety net; holds also expire lazily whenever an event, booking or dashboard is read.
4. Point the Razorpay webhook at `https://<domain>/api/webhooks/razorpay`.
5. Smoke test: sign up (confirmation e-mail from `noreply@eventdeck.online`), book, pay with a test card (tickets are issued once payment is verified), download the PDF, scan it from a phone over HTTPS, reset a password.

## Provisioning the first administrator

Admin rights can't be obtained through the web app. From a trusted machine with the production env vars loaded:

```bash
ADMIN_EMAIL=you@university.edu ADMIN_NAME="Your Name" npm run admin:create
```

If the account doesn't exist it is created (email pre-confirmed). Without `ADMIN_PASSWORD`, a strong random password is generated and printed **once** to your terminal — store it in a password manager. Running it for an existing account just promotes it.

## Testing & Functional QA Manual

> **Primary Manual for Evaluators & Testers:**  
> A complete, step-by-step testing manual with verified workflows, test-card tables, Netbanking simulation steps, role authorization scenarios, and pre-demonstration checklists is available at:  
> 📘 **[Complete Functional Testing Manual (`docs/testing/TESTING_MANUAL.md`)](docs/testing/TESTING_MANUAL.md)**

### Companion Testing Guides:
* **[Test Cases Matrix (`docs/testing/TEST_CASES.md`)](docs/testing/TEST_CASES.md)**: 84 detailed test cases across 13 modules covering all roles, payment methods, and security negative tests.
* **[Role-Based Test Account Guide (`docs/testing/TEST_ACCOUNTS.md`)](docs/testing/TEST_ACCOUNTS.md)**: Pre-seeded accounts, credential safety, and safe admin/moderator provisioning.
* **[Razorpay Payment Testing Guide (`docs/testing/PAYMENT_TESTING_GUIDE.md`)](docs/testing/PAYMENT_TESTING_GUIDE.md)**: Test Mode setup, Indian test cards, Netbanking simulation, error codes, and webhook verification.

### Automated Test Commands

| Command | Covers |
| --- | --- |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | State machine, server pricing, QR tokens & scan parsing, CSV formula-injection guard, IST time handling, Zod schemas, Razorpay checkout/webhook signatures, live-key / production simulator guards, poster magic-byte sniffing |
| `npm run test:integration` | Against the Supabase **test** project (`.env.test`): 20 concurrent buyers for 5 seats (no oversell), idempotent submissions, limits / deadlines / eligibility, ten-minute expiry releasing once under concurrent sweeps, participant cancellation, checkout+webhook race, failure → retry, late-payment recovery vs. exception, organizer authorization, single ticket issuance, complimentary passes, check-in duplicates / wrong event / window, cancellation → invalidation → refunds, payment after cancellation → refund queued, webhook route (bad signature, dedupe) |
| `npm run test:e2e` | Playwright (desktop + Pixel 7): discovery & search, unlisted/draft visibility, anonymous & role-based access (pages + APIs), signup → participant only, organizer application → admin approval, paid multi-ticket booking with decline + retry → approval → QR + PDF (and PDF denied to others), free registration rejection, hold cancellation releasing seats, event create/publish/edit/unpublish, scanner check-in + duplicate + invalid, admin cancellation → refund processing → audit + CSV, mobile layouts without horizontal scroll |

Unit tests need no database. **Integration and E2E tests run against a dedicated Supabase test project** configured in `.env.test` — never the project in `.env.local`, and never a local/Docker database:

1. Create a second (free) Supabase project for testing. In it, turn **off** Authentication → Email → *Confirm email* (UI signup tests sign in immediately; no mail is sent).
2. `cp .env.test.example .env.test` and fill in that project's URL, keys and session-pooler connection string.
3. Prepare it once:

```bash
npm run test:db:migrate
```

```bash
npm run test:db:seed
```

```bash
npx playwright install chromium
```

`tests/env-guard.ts` refuses to run if `.env.test` is missing, if its database is not a Supabase host, or if it points at the primary project from `.env.local` (unless you explicitly set `ALLOW_TESTS_ON_PRIMARY_PROJECT=true` to accept isolated, self-cleaning test data there). E2E starts its own dev server on port 3100 (`NEXT_DIST_DIR=.next-e2e`) so it never shares your normal dev server, and its teardown deletes only rows it created.

## QA

The full QA plan, test cases, bug report and final report live in [`docs/qa/`](docs/qa/QA_FINAL_REPORT.md). Supabase PostgreSQL is the only database for development, tests, staging and production — no Docker or local PostgreSQL is used. With `.env.test` set up as described under [Testing](#testing--functional-qa-manual):

```bash
npx vitest run
```

```bash
npx playwright test
```

## Documentation

Full architectural specifications, standard operating procedures, developer guides, and testing manuals are organized under [`docs/`](docs/README.md):

* **[Functional Testing Manual](docs/testing/TESTING_MANUAL.md)**: Complete step-by-step testing manual for evaluators and QA testers.
* **[Test Cases Matrix](docs/testing/TEST_CASES.md)**: 84 identifiable test cases with preconditions, steps, and expected outcomes.
* **[Role-Based Test Accounts](docs/testing/TEST_ACCOUNTS.md)**: Safe credentials inventory, setup commands, and role boundaries.
* **[Razorpay Payment Testing Guide](docs/testing/PAYMENT_TESTING_GUIDE.md)**: Sandbox checkout, official test cards, Netbanking simulation, and webhooks.
* **[System Architecture](docs/architecture/PROJECT_ARCHITECTURE.md)**: System design, data flow, concurrency control, and security boundaries.
* **[Contributing Guidelines](docs/development/CONTRIBUTING.md)**: Branch naming, git workflow, and pull request checklist.
* **[Coding Standards](docs/development/CODING_STANDARDS.md)**: Engineering conventions, React 19 patterns, and validation rules.
* **[Windows Setup & Run Manual](docs/WINDOWS_SETUP_AND_RUN.md)**: Complete Windows 10/11 installation, configuration, testing and troubleshooting manual.
* **[Environment Variables](docs/ENVIRONMENT_VARIABLES.md)**: Every variable the code reads, with purpose and public/secret classification.
* **[Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)**: Deploying to Vercel, Supabase Cloud, custom domain (`eventdeck.online`), and Brevo SMTP.
* **[Troubleshooting Guide](docs/troubleshooting/TROUBLESHOOTING.md)**: Diagnostics and resolutions for common issues.
* **[QA Test Suite](docs/qa/QA_FINAL_REPORT.md)**: Test plan, test cases, and quality audit report.

## Known limitations

* **Rate limiting** relies on Supabase Auth's built-in limits plus request-size/pagination caps; there is no distributed per-IP rate limiter (no paid infrastructure by design).
* **Refunds** are only for officially cancelled events; individual refunds for rejected paid bookings are handled off-app and recorded via **Admin → Exceptions → Mark resolved**.
* **Email**: the app sends no e-mail itself; event notifications are in-app and realtime. Supabase Auth sends sign-up confirmation and password-reset e-mails through Brevo SMTP (configured in the Supabase dashboard, sender `noreply@eventdeck.online`).
* **Vercel Hobby cron** runs at most once a day; correctness doesn't depend on it because expiry is enforced lazily on every relevant read.
* Free-tier quotas (Supabase database size/egress, Realtime connections, Vercel function time) apply — check the providers' current terms before an event with large attendance.
