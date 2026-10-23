# EventDeck

A web application for running events at a multi-campus university (built around SRM Institute of Science and Technology). It covers publication, discovery, booking, Razorpay **Test Mode** payments, QR tickets, door check-in, cancellations with refunds, organizer payouts, notifications, an audit log and reports.

> **Payments are Test Mode only.** Live Razorpay keys (`rzp_live_…`) are refused, so no real money moves. Payouts are recorded, not transferred.

**Maintainers, start with the [Project Maintenance Manual](docs/PROJECT_MAINTENANCE_MANUAL.md).** It is the full guide to architecture, setup, the data model, workflows, deployment, troubleshooting and current status.

---

## Features

| Area | What is implemented |
| --- | --- |
| Accounts | Four-step sign-up with institution profiles (SRM campuses, other colleges, guests); SRM-student status only with an SRM e-mail; organizer applications approved by admins |
| Events | Tiers, capacities, registration and check-in windows, posters, audience rules (campus-only, inter-campus, approved colleges, open), draft/publish/unpublish, public or unlisted |
| Booking | Transactional seat reservation (no overselling), 10-minute payment holds, at most 4 tickets per person per event, idempotent submissions, complimentary pass requests |
| Payments | Server-priced Razorpay orders, verified checkout and webhook signatures, late-payment recovery or payment exceptions; local simulator for development |
| Tickets | One QR ticket per seat (random 192-bit token), access-controlled PDF passes |
| Check-in | Camera or typed ticket number; event-scoped moderators; each ticket admitted once even across devices |
| Administration | Cancellations → refunds, payouts (5 % fee, UTR recorded), payment exceptions, people and roles, CSV reports, audit log |
| Notifications | In-app, live through Supabase Realtime |

## Technology

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui (Base UI) · Supabase (Auth, PostgreSQL, Storage, Realtime) · Drizzle ORM + drizzle-kit · Zod + React Hook Form · Razorpay (Test Mode) · pdf-lib, qrcode, html5-qrcode, sharp · Vitest, Playwright · Vercel. Auth e-mails go out through Supabase Auth using Brevo SMTP.

## Architecture in brief

One Next.js application. `src/proxy.ts` refreshes the Supabase session. Pages, Server Actions (`src/app/actions`) and route handlers (`src/app/api`) authenticate with `src/lib/auth.ts` and call services in `src/lib/server` that check ownership and write inside PostgreSQL transactions. Pure rules live in `src/lib/domain`. Row-level security is enabled on all 17 tables, and browser clients cannot write. Details: [docs/architecture/PROJECT_ARCHITECTURE.md](docs/architecture/PROJECT_ARCHITECTURE.md).

## Getting started

Requirements: Node.js 20.9+ (24 LTS recommended), npm, Git, and a Supabase project. No Docker or local PostgreSQL is needed.

```bash
git clone https://github.com/Eventdeck88/EventDeck.git
cd EventDeck
npm ci
cp .env.example .env.local
npm run dev
```

On Windows, use `Copy-Item .env.example .env.local` in PowerShell for the copy step.

Fill in `.env.local` before starting the server; every variable is described in [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md). On **your own** Supabase project, create the schema with `npm run db:migrate`, and optionally add fictional demo data with `npm run db:seed`. Do not run either against a shared or production database without agreement. Then open <http://localhost:3000>.

Guides: [Development setup (any OS)](docs/development/DEVELOPMENT_SETUP.md) · [Windows 10/11 manual](docs/WINDOWS_SETUP_AND_RUN.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run lint` · `npm run typecheck` · `npm run test:unit` | Checks (no database needed) |
| `npm run verify` | All three checks above |
| `npm run test:integration` · `npm run test:e2e` | Database and browser tests; need a separate Supabase test project in `.env.test` ([docs/testing/TESTING.md](docs/testing/TESTING.md)) |
| `npm run build` · `npm run start` | Production build and local production server |
| `npm run db:generate` · `npm run db:migrate` | Create / apply SQL migrations (`drizzle/`) |
| `npm run db:seed` · `npm run seed:dsa` · `npm run admin:create` | Demo data, demo poster events, first administrator |

## Deployment

Vercel, with the production domain `https://eventdeck.online`. `vercel.json` schedules a daily hold-expiry cron. Required dashboard settings for Vercel, Supabase (URL configuration, SMTP), Razorpay webhooks and DNS are in [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md).

## Current status and known limitations

- **`npm run build` currently fails** with a Next.js `SecurityFatalError`: `next` 16.4.0 is affected by critical advisories, fixed in 16.4.2. Upgrade before the next deployment.
- **Open connection-pooling issue:** parallel queries can hang through Supabase's transaction pooler. See [troubleshooting §1.2](docs/troubleshooting/TROUBLESHOOTING.md).
- Integration and end-to-end suites have not run since 14 Oct 2026 (no dedicated test project yet). Unit tests pass (65/65, 23 Oct 2026).
- No waiting lists, invite-only lists, seat maps, live payments or automated bank payouts.
- Refunds exist only for officially cancelled events. Rate limiting relies on Supabase Auth's limits. The Vercel Hobby cron runs once a day, but holds also expire whenever bookings are read.
- Full list and priorities: [maintenance manual §18](docs/PROJECT_MAINTENANCE_MANUAL.md#18-current-status-and-future-work).

## Documentation

[docs/README.md](docs/README.md) indexes everything: architecture, development, deployment, troubleshooting, testing and QA, the academic report and presentation, and the repository cleanup report.

## Author

Designed and developed by **Matheshwaran R** ([@matheshwaran-io](https://github.com/matheshwaran-io)) as an MCA project.

## License

No license has been chosen yet. Until one is added, the code is not licensed for reuse by others.
