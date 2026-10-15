# EventDeck — QA Test Plan

_Last updated: 2026-10-14 · Scope: repository `Eventdeck88/EventDeck`, branch `main` + working tree_

## 1. System under test

| Aspect | Actual implementation (from repository audit) |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, shadcn/ui (Base UI) |
| Package manager | npm (`package-lock.json`) |
| Database | Supabase Postgres via Drizzle ORM; migrations `drizzle/0000`–`0005` |
| Auth | Supabase Auth (email + password, password reset), `@supabase/ssr` cookies, `src/proxy.ts` session refresh + route gate |
| Authorization | Server-side role + ownership checks in `src/lib/server/*`; Postgres RLS on every table (API roles have no write grants) |
| Payments | Razorpay **Test Mode** (`rzp_test_` keys enforced) with a local simulator when keys are absent (never on Vercel production) |
| Storage | Supabase Storage: `posters` (public), `tickets` (private PDF cache) |
| Realtime | Supabase Realtime on `notifications`, `bookings` (RLS-filtered) |
| Hosting target | Vercel + hosted Supabase project `tigjkndhhvezjegrxqsn`. **No deployment URL exists yet.** |

### Roles (as implemented — exactly three platform roles)

| Role (`profiles.role`) | Constant in code | Summary |
| --- | --- | --- |
| `participant` | `PARTICIPANT` | Default for every signup (DB trigger). Browse, book, pay, request passes, cancel unpaid bookings, download tickets. |
| `organizer` | `EVENT_ORGANIZER` | Granted by an admin. Manages **own** events, verifies bookings, assigns moderators, scans, reports for own events. |
| `admin` | `UNIVERSITY_ADMIN` | Provisioned only via CLI. Everything, including people, cancellations, refunds, exceptions, global reports, audit. |

**Event moderator** is *not* a fourth role: it is an event-scoped assignment (`event_moderators`) any active account can hold. A moderator keeps their platform role and gains only `scan tickets for that event`.

Participant **profile classification** (not roles): `institution_type` (SRM / external institution / guest), `campus` (KTR, Ramapuram, Vadapalani, other SRM), `affiliation` (student, faculty, staff, alumni, guest), plus legacy `category` used by older eligibility rules.

## 2. Module inventory

| # | Module | Main route / component | Role access | Key dependencies | Test status |
| --- | --- | --- | --- | --- | --- |
| M1 | Sign-up (4-step, institution onboarding) | `/signup`, `signup-form.tsx`, `actions/auth.ts` | Public | Supabase Auth, `handle_new_user` trigger | ✅ Unit + integration + E2E |
| M2 | Sign-in / sign-out / session | `/login`, `proxy.ts`, `lib/auth.ts` | Public / all | Supabase Auth cookies | ✅ E2E (refresh, expiry) |
| M3 | Password reset | `/forgot-password`, `/reset-password`, `/auth/confirm` | Public | Supabase Auth recovery tokens | ✅ E2E (admin-generated recovery token → real reset pages; no email sent) |
| M4 | Profile & organizer application | `/my/profile` | Signed-in | `users.ts` | ✅ Integration + E2E |
| M5 | Discovery & search | `/`, `/events` | Public | Postgres FTS, filters incl. **audience** | ✅ E2E + integration |
| M6 | Event detail & ticket selection | `/events/[slug]`, `ticket-selector.tsx` | Public / participant | eligibility, inventory | ✅ E2E |
| M7 | Booking engine (holds, inventory, idempotency) | `lib/server/bookings.ts` | Participant (server) | Postgres transactions | ✅ Integration (concurrency) |
| M8 | Payments (order, verify, webhook, simulator) | `/api/payments/*`, `/api/webhooks/razorpay` | Participant / Razorpay | Razorpay Test API | ✅ Integration + E2E; ⚠ real Checkout modal manual |
| M9 | Organizer verification & passes | `/organizer/events/[id]/bookings` | Organizer (own) / admin | bookings, tickets | ✅ Integration + E2E |
| M10 | Tickets, QR, PDF | `/my/bookings/[id]`, `/api/tickets/[id]/pdf` | Owner / admin | pdf-lib, qrcode, Storage | ✅ Integration + E2E |
| M11 | Scanner & check-in | `scanner.tsx`, `/api/checkin`, `checkin.ts` | Organizer (own), admin, **assigned moderators** | html5-qrcode | ✅ Integration + E2E + fake-camera E2E |
| M12 | **Event moderators** (new) | `/organizer/events/[id]/team`, `/moderate`, `/moderate/[eventId]` | Organizer/admin assign; moderator scans | `event_moderators`, RLS | ✅ Integration + E2E |
| M13 | **Audience eligibility** (campus / inter-campus / inter-college) (new) | event form, `lib/domain/eligibility.ts` | Organizer configures; server enforces | profile classification | ✅ Unit + integration + E2E |
| M14 | Event CRUD / publish / unpublish | `/organizer/events/new`, `/edit`, `EventActions` | Organizer (own) / admin | Storage (posters) | ✅ E2E + integration |
| M15 | Cancellation & refunds | `/admin/cancellations`, `/admin/refunds` | Organizer requests, admin approves | Razorpay refunds (test) | ✅ Integration + E2E |
| M16 | Payment exceptions | `/admin/exceptions` | Admin | — | ✅ Integration (late payment) + E2E page load |
| M17 | Notifications (in-app + realtime) | bell, `/my/notifications` | Signed-in | Supabase Realtime | ✅ Integration; realtime verified manually in browser earlier |
| M18 | Reports / CSV | `/api/reports/[type]`, `/admin/reports` | Organizer (own event), admin | — | ✅ Unit (formula injection) + E2E |
| M19 | Audit log | `/admin/audit`, event Activity tab | Admin; organizer (own events) | — | ✅ E2E |
| M20 | People admin | `/admin/users` | Admin | Supabase Auth admin (ban) | ✅ E2E + integration |
| M21 | Cron sweep | `/api/cron/expire-holds` | `CRON_SECRET` | Vercel Cron | ⚪ Logic covered via `expireHolds` integration; route not separately tested |

Not implemented (documented, not faked): waitlists, invite-only (allow-list) events, moderator invitations to people without an account, explicit "completed" event status (past events are shown as *Ended*).

## 3. Test environment & data safety

* **Supabase PostgreSQL is the only database** — development (`.env.local`, primary project), automated tests (`.env.test`, a **dedicated Supabase test project**), staging and production. No Docker, no local PostgreSQL.
* `tests/env-guard.ts` runs before every integration/E2E run (Vitest `integration` project setup, `playwright.config.ts`, E2E teardown) and refuses to continue unless `.env.test` exists, its database is a Supabase host matching its project URL, and it is **not** the primary project — unless the owner explicitly sets `ALLOW_TESTS_ON_PRIMARY_PROJECT=true` (isolated, self-cleaning fixtures).
* Unit tests are a separate Vitest project with no env files and no database.
* Playwright starts its own dev server on **port 3100** with a separate build dir (`NEXT_DIST_DIR=.next-e2e`) using the test project's env.
* Fixtures are unique and self-cleaning; integration helpers delete only rows they created; `e2e/global-teardown.ts` deletes only `E2E …` events and `e2e+…` accounts and releases inventory they held. No reset, truncate or bulk cleanup exists anywhere.
* No test sends email: accounts are created with the admin API (`email_confirm: true`), password reset uses admin-generated recovery tokens, and the signup-bypass test uses a direct `auth.users` insert when the project has *Confirm email* on.
* Payments in tests use the simulator; Razorpay Test Mode keys were probed once manually (₹1 test order).

## 4. Strategy

| Layer | Tool | Focus |
| --- | --- | --- |
| Unit | Vitest | State machine, pricing, eligibility rules & labels, QR/scan parsing, CSV safety, IST time, Zod schemas, Razorpay signatures, payment-mode guards, upload sniffing |
| Integration | Vitest + Supabase test project (Postgres, Auth, Storage) | Concurrency (inventory, check-in), idempotency, ownership, moderators, audience rules, RLS via real user sessions, signup-trigger bypass attempts, webhook route |
| End-to-end | Playwright (desktop, Pixel 7, 820×1180 tablet, fake-camera Chromium) | Full journeys per role, moderator workflow, audience rules via UI, password reset via local mail, console/5xx sweep, keyboard, session, camera denial, real QR decoding |
| Static | ESLint, `tsc`, `next build` | Regressions, build health |

Severity scale: P0 critical (security / data / payments / forged tickets), P1 high (core workflow broken), P2 medium, P3 low.

## 5. How to run

```bash
cp .env.test.example .env.test   # fill in a dedicated Supabase TEST project
npm run test:db:migrate          # migrate the TEST project (.env.test)
npm run test:db:seed             # demo accounts/events in the TEST project
npm run lint && npm run typecheck
npx vitest run --project unit    # no database needed
npx vitest run                   # unit + integration (test project)
npx playwright test              # E2E on :3100 against the test project
npm run build
```
