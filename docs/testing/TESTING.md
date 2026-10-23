# Testing Overview

Where the tests are, how to run them, what they cover, and what is not tested. For manual QA procedures see [TESTING_MANUAL.md](TESTING_MANUAL.md) and [TEST_CASES.md](TEST_CASES.md); demo accounts: [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md); Razorpay test cards: [PAYMENT_TESTING_GUIDE.md](PAYMENT_TESTING_GUIDE.md); historical QA run: [../qa/QA_FINAL_REPORT.md](../qa/QA_FINAL_REPORT.md).

## Suites

| Suite | Runner / config | Files | Tests | Needs |
| --- | --- | --- | --- | --- |
| Unit | Vitest, project `unit` (`vitest.config.mts`) | `tests/unit/`: auth-onboarding, domain, eligibility, payouts, security, url | 65 | Nothing (no database) |
| Integration | Vitest, project `integration` | `tests/integration/`: api-security, auth-authorization, booking-engine, eligibility-bypass, moderators, storage, webhook-route | 53 | `.env.test` → dedicated Supabase test project |
| End-to-end | Playwright (`playwright.config.ts`, own dev server on port 3100, build dir `.next-e2e`) | `e2e/`: admin, audience, booking, camera, mobile, moderators, organizer, password-reset, public, quality, roles | 24 tests (26 runs across desktop, phone, tablet and fake-camera projects) | Same test project + `npx playwright install chromium` |

## Commands

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run verify
```

`npm run verify` = lint + type check + unit tests. `npm test` runs Vitest across all projects (unit + integration).

## Test project setup (integration and E2E)

1. Create a second Supabase project and turn **off** Authentication → Email → *Confirm email* in it.
2. `cp .env.test.example .env.test` and fill in that project's values. Use the session pooler URL for both database variables.
3. Run each once:

   ```bash
   npm run test:db:migrate
   npm run test:db:seed
   npx playwright install chromium
   ```

`tests/env-guard.ts` stops the run if `.env.test` is missing, is not a Supabase host, or points at the main project (`ALLOW_TESTS_ON_PRIMARY_PROJECT=true` overrides that last check, but only use it if you accept self-cleaning test rows there). E2E teardown deletes only rows it created. Payments in tests always use the built-in simulator.

## Coverage

- **Unit:** booking state machine, server-side pricing, QR tokens and scan parsing, CSV formula neutralisation, IST time and money formatting, Zod schemas (events, sign-up, SRM e-mail rule, 4-per-person limit), audience eligibility, Razorpay checkout and webhook signatures, live-key and production-simulator guards, poster magic-byte sniffing, payout validation and fees, URL resolution and `safeRedirectPath`.
- **Integration:** concurrent bookings (no oversell), idempotency, holds and expiry, late payments, webhook dedupe, checkout/webhook races, organizer and moderator authorization, simultaneous scans, eligibility bypass attempts, PostgREST access with user tokens, storage.
- **E2E:** discovery, sign-up/sign-in/reset, role access, booking with simulated payment, organizer event lifecycle, moderators and scanning (including a fake camera), admin cancellation → refunds, mobile/tablet layouts, keyboard basics.

## Status (23 Oct 2026)

| Suite | Result |
| --- | --- |
| Unit | **65/65 passed** (23 Oct 2026) |
| Integration | Not run since 14 Oct 2026 (passed then, on a local stack that has since been removed). No test project exists yet. |
| End-to-end | Same. `e2e/booking.spec.ts` was updated on 15 Oct for automatic approval of paid bookings and has never run since. |

## Known gaps

- Integration and E2E results are not current.
- No load or capacity testing. The concurrency tests prove correctness, not capacity.
- No automated test for the connection-pooling hang (see [../troubleshooting/TROUBLESHOOTING.md](../troubleshooting/TROUBLESHOOTING.md) §1.2).
- Manual only: Razorpay Checkout modal with test cards, phone camera over HTTPS, real e-mail delivery through Brevo.
