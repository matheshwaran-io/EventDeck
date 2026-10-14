# EventDeck — QA Bug Report

All defects below were reproduced before fixing (failing test or direct evidence), fixed in the smallest reasonable place, and covered by a regression test. Severity: P0 critical · P1 high · P2 medium · P3 low.

---

## QA-001 · P0 · Anyone could self-classify as an SRM student through a direct Auth signup — **FIXED**

* **Area**: signup trigger `public.handle_new_user()` (migration `0002_institution_onboarding.sql`)
* **Preconditions**: public Supabase URL + publishable key (both are public by design).
* **Steps**: call `supabase.auth.signUp({ email: "x@gmail.com", options: { data: { institution_type: "SRM", campus: "KTR", affiliation: "STUDENT" } } })` directly (not through the app). Also: sign up with **no** metadata.
* **Expected**: SRM student/staff status requires an official SRM email, as the app's own signup validation states.
* **Actual**: profile created as `institution_type = SRM`, `category = host_student` in both cases — the trigger trusted client metadata and **defaulted to SRM student**. Eligibility for SRM-only/campus-only events could be bypassed.
* **Root cause**: the server-action validation (`signupSchema`) was the only gate; the DB trigger, reachable directly via Supabase Auth, applied no domain check.
* **Fix**: `drizzle/0003_srm_email_gate.sql` — trigger now downgrades SRM student/staff claims without an `@srmist.edu.in` / `@srmuniv.ac.in` email to `GUEST` (signup still succeeds; least privilege).
* **Regression**: `tests/integration/eligibility-bypass.test.ts` (3 cases, real Supabase Auth signups). Failed before fix, pass after.

## QA-002 · P0 · External users could switch themselves to "SRM student" by editing their profile — **FIXED**

* **Area**: `updateOwnProfile` (`src/lib/server/users.ts`), `profileSchema`
* **Steps**: as an external participant (`…@vit.ac.in`) submit the profile form with `institutionType: SRM, campus: KTR, affiliation: STUDENT`.
* **Expected**: refused (same rule as signup).
* **Actual**: accepted; category became `host_student`.
* **Fix**: server-side check in `updateOwnProfile` — SRM student/staff requires an SRM email; returns a clear error.
* **Regression**: `eligibility-bypass.test.ts` (2 cases: external refused, SRM user can still change campus).

## QA-003 · P1 · Missing feature: organizers could not delegate check-in to moderators — **IMPLEMENTED**

* **Impact**: only the owning organizer or an admin could scan; the required "organizer assigns trusted friends to scan entry" workflow was impossible.
* **Implementation** (existing architecture):
  * `event_moderators` table (`0004`), RLS + `moderates_event()` (`0005`), unique active assignment per event/user, cap 10.
  * Service `src/lib/server/moderators.ts` (`assertCanScanEvent` checked on **every** scan → revocation is immediate), actions, notifications, audit (`moderator.added/revoked`).
  * Organizer **Team** tab; moderator **Check-in** area (`/moderate`, `/moderate/[eventId]`); `/api/checkin` now authorises per event instead of by role; attendance + CSV show who scanned.
* **Tests**: `tests/integration/moderators.test.ts`, `e2e/moderators.spec.ts`, `e2e/camera.spec.ts`.

## QA-004 · P1 · Missing feature: events could not be restricted by campus or institution — **IMPLEMENTED**

* **Impact**: profiles record campus and institution, but events could only filter by legacy `category`; e.g. SRM faculty and external faculty were indistinguishable, and campus-only / inter-campus / approved-college events were impossible.
* **Implementation**: `events.eligible_institution_types`, `eligible_campuses`, `eligible_institutions` (`0004`); pure rules `src/lib/domain/eligibility.ts` (server-side, stored profile only, normalised institution names); event form controls; audience labels on cards/detail; discovery **Audience** filter; specific refusal reasons for ineligible viewers.
* **Tests**: `tests/unit/eligibility.test.ts`, integration audience block in `moderators.test.ts`, `e2e/audience.spec.ts`.

## QA-005 · P1 (process) · Automated tests were wired to the hosted database — **FIXED**

* **Evidence**: commit `27c6a68` pointed `.env.local` at the hosted project; `tests/setup.ts`, `drizzle.config.ts`, `e2e/helpers.ts` all read `.env.local`. Running the suites would create/delete users, events and bookings in the hosted DB.
* **Fix (revised 2026-10-14)**: tests use a **dedicated Supabase test project** via `.env.test` (template `.env.test.example`). `tests/env-guard.ts` refuses a missing `.env.test`, non-Supabase databases, and the primary project (unless `ALLOW_TESTS_ON_PRIMARY_PROJECT=true`). The interim local Docker stack used during the first QA pass has been removed entirely (see QA-009).

## QA-006 · P3 · E2E signup helper broken by the new 4-step signup — **FIXED**

* **Evidence**: 5 of 13 baseline E2E tests failed (`getByLabel('Password')` matched 4 elements; wizard steps not handled).
* **Fix**: `e2e/helpers.ts#signUp` walks the wizard and supports guest / SRM-campus / external identities.

## QA-007 · P2 · Drizzle snapshot drift from the hand-written institution migration — **FIXED**

* **Evidence**: `drizzle-kit generate` re-emitted the `0002` enums/columns because custom SQL does not update snapshots; applying that output would fail on any migrated DB.
* **Fix**: duplicate statements removed from `0004` (comment explains why); snapshot now includes the columns so future generations are clean.

## QA-008 · P3 · Lint scanned generated E2E build output — **FIXED**

* `.next-e2e/**` (and `.claude/**`, reports) added to ESLint ignores.

---

## QA-009 · P2 (process) · Test setup depended on a local Docker Supabase stack — **FIXED**

* **Requirement**: Supabase PostgreSQL is the single database platform; no Docker/local Postgres.
* **Found**: `test:db:start` (`supabase start`), the `supabase` CLI dev dependency, `supabase/config.toml`, `.env.test` pointing at `127.0.0.1:54322`, localhost-only guards, the password-reset E2E reading the local mail catcher (`127.0.0.1:54324`), and Docker instructions in README/QA docs.
* **Fix**: all removed or replaced with the Supabase-test-project setup above; local containers and volumes stopped and deleted (`supabase stop --no-backup`); password-reset E2E now uses admin-generated recovery tokens; signup-bypass test avoids sending mail.

## Open items (not defects in shipped behaviour, or need a business decision)

| ID | Severity | Item |
| --- | --- | --- |
| OPEN-1 | P2 (risk) | **Campus within SRM is self-declared** (an SRM email proves SRM membership, not campus). Faculty/alumni from non-SRM emails are also self-declared, per the existing signup rules. Mitigation in place: every booking needs organizer verification and the queue shows the participant's classification. A stronger control (admin-verified affiliation or campus-specific email domains) is a business decision. |
| OPEN-2 | — | ~~Hosted DB missing migrations 0003–0005~~ — **applied** with `npm run db:migrate` (6/6); row counts unchanged (79 profiles, 29 events, 29 bookings). |
| OPEN-3 | P3 | Moderators must already have an account (no pending invite-by-email). |
| OPEN-4 | P3 | Attendance list is not paginated (fine for hundreds; consider pagination for thousands). |
| OPEN-5 | P3 | No app-level rate limiting beyond Supabase Auth's built-ins (by design: no paid infra). |
| OPEN-6 | — | Waitlists and invite-only events are not implemented. |
