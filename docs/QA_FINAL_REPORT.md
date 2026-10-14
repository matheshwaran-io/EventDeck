# EventDeck — QA Final Report

_Date: 2026-10-14 · Updated after removing the Docker database dependency (see §8)_

## 1. Verdict

**Ready for demonstration and submission.** Migrations `0003`–`0005` are now applied to the hosted Supabase project. All critical workflows passed automated end-to-end tests; both P0 defects found were fixed with regression tests; no P0/P1 defect remains open. Integration/E2E must be re-run once a dedicated Supabase test project is configured (§8).

## 2. Results (actual commands and outcomes)

> The full Vitest + Playwright results below were produced during the first QA pass on an interim local Supabase stack (Docker). That stack has since been removed per the project requirement that Supabase PostgreSQL is the only database (§8). Integration and E2E have **not yet been re-run** on a hosted Supabase test project because none is configured; unit tests, lint, types and build were re-run after the change.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **0 errors**, 3 warnings (React Compiler notes on React Hook Form `watch()`; informational) |
| Types | `npm run typecheck` | **0 errors** |
| Unit + integration | `npx vitest run` | **94 / 94 passed** (11 files: 41 unit, 53 integration against real Postgres/Auth/Storage) |
| End-to-end | `npx playwright test` | **26 / 26 passed** — 23 desktop, 1 phone (Pixel 7), 1 tablet (820×1180), 1 fake-camera Chromium |
| Production build | `npm run build` | **Succeeded** (44 app routes incl. new `/moderate`, `/team`) |
| Migrations (test DB) | `npm run test:db:migrate` | 6 / 6 applied to the local DB |

Baseline before QA work: lint ✔, types ✔, Vitest 67/67, Playwright **8 passed / 5 failed** (helper drift, QA-006).

### Counts

| Category | Count |
| --- | --- |
| Automated tests passed | 120 (94 Vitest + 26 Playwright) |
| Automated tests failed | 0 |
| Tests blocked by environment / credentials | 3 — physical phone camera over HTTPS (no deployment URL), Razorpay Checkout modal with a test card (third-party UI), hosted-Supabase email delivery |
| Tests not run | Load testing beyond the concurrency tests below (no isolated capacity to measure) |
| Bugs fixed & retested | 8 (QA-001 … QA-008), incl. 2 × P0 |
| Bugs still open | 0 P0/P1; open items OPEN-1…OPEN-6 are risks, a pending owner action, or unimplemented scope |

## 3. Acceptance criteria

| Criterion | Evidence | Met |
| --- | --- | --- |
| All roles & permission boundaries verified | `QA_TEST_CASES.md` §A–B; UI + direct API + PostgREST with real JWTs | ✅ |
| Organizer creates and publishes a test event | `e2e/organizer.spec.ts`, `e2e/audience.spec.ts` | ✅ |
| Organizer assigns and revokes event-specific moderators | `e2e/moderators.spec.ts` (4 moderators via UI, revoke), `tests/integration/moderators.test.ts` | ✅ |
| Authorized moderators validate and check in attendees | same + `e2e/camera.spec.ts` (real QR decoded from a camera feed) | ✅ |
| Duplicate and invalid scans rejected | incl. **simultaneous scans by two moderators** (integration ×4 concurrent, E2E ×2 sessions) | ✅ |
| Ticket validation is server-authoritative | QR carries only a 192-bit token; tampered/forged/JSON payloads rejected; status, event, approval, window all read from DB | ✅ |
| Registration → ticket → check-in journey end to end | `e2e/booking.spec.ts` + `e2e/moderators.spec.ts` | ✅ |
| Multi-campus & external-institution rules | campus-only, inter-campus, approved-college, open; via UI and server | ✅ (with OPEN-1 risk) |
| Every module has a documented status | `QA_TEST_PLAN.md` §2 | ✅ |
| Critical/high bugs fixed or reported | `QA_BUG_REPORT.md` | ✅ |
| Build and automated tests run | §2 above | ✅ |
| No destructive production operations or live payments | All tests ran on localhost DB (enforced by guards); one Razorpay **Test Mode** ₹1 order probe | ✅ |

## 4. What changed in the code during QA

* **Security fixes**: SRM-email gate in the signup trigger (`drizzle/0003_srm_email_gate.sql`) and in profile updates (`src/lib/server/users.ts`).
* **Moderators**: `event_moderators` (+RLS), `src/lib/server/moderators.ts`, `src/app/actions/moderators.ts`, `/organizer/events/[id]/team`, `/moderate`, `/moderate/[eventId]`, per-event authorization in `/api/checkin`, attribution in attendance/CSV, "Check-in" nav for moderators.
* **Audience rules**: `src/lib/domain/eligibility.ts`, new event columns, event-form controls, audience labels, discovery filter, specific refusal reasons; enforced in `createBooking` from the stored profile.
* **Test infrastructure**: `.env.test` + localhost guards, Playwright on :3100 with `.next-e2e`, fake-camera QR video (`e2e/global-setup.ts`), teardown of E2E data, new specs (`moderators`, `audience`, `camera`, `quality`, `password-reset`), tablet project, new integration suites (`moderators`, `eligibility-bypass`, `api-security`).

## 5. Measured reliability evidence

* 20 concurrent bookings for 5 seats → exactly 5 succeed (no oversell).
* 4 concurrent scans of one ticket by two moderators → exactly 1 check-in row.
* Checkout callback + 2 webhook deliveries racing → exactly 1 confirmation.
* 3 concurrent hold-expiry sweeps → inventory released exactly once.
* Inventory invariant (`allocated` = seats held by live bookings) verified after E2E teardown.

These are correctness-under-concurrency checks, not capacity measurements; no production load claim is made.

## 6. Outstanding risks & manual checks still required

1. **Create a dedicated Supabase test project**, fill `.env.test` from `.env.test.example`, turn off *Confirm email* there, run `npm run test:db:migrate && npm run test:db:seed`, then `npx vitest run` and `npx playwright test`.
2. **Physical camera scanning** on a phone over HTTPS once deployed (camera decoding itself is verified via Chromium's fake webcam).
3. **Razorpay Checkout modal** with a Razorpay test card in a browser against the deployed site, then confirm the `payment.captured` webhook arrives (`RAZORPAY_WEBHOOK_SECRET` configured, webhook URL registered).
4. **Hosted email**: Supabase free-tier email is rate-limited; confirm signup confirmation / reset emails arrive, or disable "Confirm email" for the demo.
5. **OPEN-1** business decision on verifying campus / non-SRM-email faculty & alumni claims.
6. Rotate the database password that was shared in chat earlier; update `.env.local` and Vercel.

## 7. Features not implemented (scope, not defects)

Waitlists · invite-only allow-list events · moderator invitations to people without accounts · explicit "completed" event status (past events display as *Ended*) · app-level rate limiting.

## 8. Docker removal (Supabase-only database) — re-verification

| Check | Command | Result |
| --- | --- | --- |
| Docker/local DB references | repository-wide search | None that start or require Docker/local Postgres; remaining mentions state that Docker is *not* used |
| Local stack | `supabase stop --no-backup` | Containers and volumes for this project removed; `supabase` CLI package and `supabase/` removed |
| Hosted migrations | `npm run db:migrate` (`.env.local`) | 6 / 6 applied; 79 profiles / 29 events / 29 bookings unchanged; all events default to "open to all" |
| Types | `npm run typecheck` | 0 errors |
| Lint | `npm run lint` | 0 errors, 3 informational warnings |
| Unit | `npx vitest run --project unit` | **41 / 41 passed** (no env file, no database) |
| Integration guard | `npx vitest run --project integration` (no `.env.test`) | Refused with "Missing .env.test" — as designed |
| Guard vs primary project | `.env.test` pointing at `tigjkndhhvezjegrxqsn` | Refused ("points at the primary project") — as designed |
| E2E guard | `npx playwright test --list` (no `.env.test`) | Refused — as designed |
| Build | `npm run build` | Succeeded |
| Integration / E2E on Supabase | — | **Blocked**: no dedicated Supabase test project configured yet |
