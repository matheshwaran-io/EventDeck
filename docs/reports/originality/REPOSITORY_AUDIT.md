# EventDeck — Repository and Report Audit

Date of audit: 15 October 2026. Repository: `/Users/maddy/Current Project/EventDeck`, branch `main`, HEAD `745e194` (working tree clean at the start of the audit).

Location note: the repository keeps documentation under `docs/` (`docs/reports/final-report/` holds the report). The originality deliverables are therefore in **`docs/reports/originality/`** rather than the `documentation/originality/` path suggested in the brief, and the revised report sits next to the original in `docs/reports/final-report/`.

---

## 1. Document inventory

| Document | Path | Role in this audit |
| --- | --- | --- |
| Final project report (source, unchanged) | `docs/reports/final-report/EventDeck_Final_Report.docx` (+ `.pdf`) | Authoritative report to revise |
| Report generator and content | `docs/reports/final-report/working-notes/build_report.py`, `report_content.py` | Text and structure of the report; the `.docx` is built from these on top of the institutional template |
| Report figures | `docs/reports/final-report/assets/diagrams/*.png` (+ SVG sources), `assets/screenshots/*.png` | 8 diagrams, 22 screenshots used in the report |
| Earlier test logs | `working-notes/unit.txt`, `tsc.txt`, `lint.txt` (15 Oct 2026, 02:06 IST) | Evidence cited by the original report |
| Institutional template | `/Users/maddy/Downloads/Electify Final Report (1).docx` (outside the repository) | Source of styles, page setup and preliminary pages |
| QA documents | `docs/qa/QA_TEST_PLAN.md`, `QA_TEST_CASES.md`, `QA_BUG_REPORT.md`, `QA_FINAL_REPORT.md` | Evidence for the 14 Oct 2026 QA run |
| Developer docs | `README.md`, `docs/architecture/`, `docs/deployment/`, `docs/troubleshooting/`, `docs/testing/`, `docs/WINDOWS_SETUP_AND_RUN.md`, `docs/ENVIRONMENT_VARIABLES.md` | Cross-checks for architecture and configuration claims |
| Presentation | `docs/reports/presentation/EventDeck_MCA_Presentation.pptx` | Checked for title consistency only |
| Plagiarism / similarity report | — | **None exists in the repository** |

## 2. Official project title

**EVENTDECK: A UNIVERSITY EVENT TICKETING SYSTEM WITH TRANSACTIONAL SEAT RESERVATION AND QR CHECK-IN**

Source: the cover page and the bonafide certificate of `EventDeck_Final_Report.docx`; the same wording appears on slide 1 of the presentation. **Caution:** this title was proposed while the report was being drafted. No approved synopsis or institutional document confirming it exists in the repository. It is preserved exactly but marked *NEEDS STUDENT/GUIDE CONFIRMATION*.

## 3. Verified technology stack (from `package.json`, configuration and code)

Next.js 16.4.0 (App Router, `src/proxy.ts`), React 19.3.0, TypeScript 5, Tailwind CSS 4, shadcn/ui on Base UI, React Hook Form + Zod 4, Supabase (Auth via `@supabase/ssr`, PostgreSQL, Storage, Realtime), Drizzle ORM 0.45 + drizzle-kit 0.31 with the `postgres` (postgres.js 3.4) driver, Razorpay (Test Mode, REST calls from `src/lib/razorpay.ts`), `qrcode`, `pdf-lib`, `html5-qrcode`, `sharp`, Vitest 5, Playwright 1.64, Vercel (`vercel.json` cron). Authentication e-mails are sent by Supabase Auth through custom SMTP (Brevo). That is a dashboard setting, not code; the evidence is limited to `docs/deployment/DEPLOYMENT_GUIDE.md` and the public DKIM/DMARC DNS records for `eventdeck.online`.

## 4. Major modules and roles (verified)

| Area | Evidence | Status |
| --- | --- | --- |
| Roles `participant`, `organizer`, `admin` | `userRole` enum in `src/db/schema.ts`; `requirePageUser`/`requireUser` in `src/lib/auth.ts` | Implemented |
| Event moderators (assignment, not a role) | `event_moderators` table; `src/lib/server/moderators.ts` (`assertCanScanEvent`, max 10) | Implemented |
| Root administrator (`eventdeck88@gmail.com`) | `ROOT_ADMIN_EMAIL` in `src/lib/constants.ts`; `getCurrentUser` override; `drizzle/0008_root_admin_protection.sql` triggers | Implemented after the original report; **not described in it** |
| Event creation, publish/unpublish, audience rules, posters | `src/lib/server/events.ts`, `src/lib/validation/event.ts`, `src/lib/domain/eligibility.ts`, `src/lib/server/storage.ts` | Implemented |
| Booking engine (atomic seats, 10-min holds, idempotency, ≤ 4 per person) | `src/lib/server/bookings.ts` (`createBooking`, `reserveInventory`, `expireHolds`), `transitions.ts` | Implemented |
| Payments (Razorpay Test Mode, signature + webhook verification, late payments) | `src/lib/server/payments.ts`, `src/app/api/payments/*`, `src/app/api/webhooks/razorpay/route.ts` | Implemented, test mode only |
| Tickets, QR, PDF | `issueTickets`, `src/lib/domain/tokens.ts`, `src/lib/server/pdf.ts`, `src/app/api/tickets/[bookingId]` | Implemented |
| Check-in | `src/lib/server/checkin.ts`, `/api/checkin`, `check_ins.ticket_id` UNIQUE | Implemented |
| Cancellations and refunds | `src/lib/server/cancellations.ts` | Implemented (Test Mode refunds) |
| Payouts | `src/lib/server/payouts.ts` (5 % fee, UTR recorded by admin; no money moved) | Implemented as records |
| Notifications, audit log, CSV reports | `src/lib/server/audit.ts`, `queries.ts`, `src/app/api/reports/[type]` | Implemented |
| Waiting lists, invite-only lists, seat maps, native apps | — | Absent (correctly listed as out of scope) |

## 5. Traceability matrix — principal report claims

| Report claim (section) | Evidence | Finding |
| --- | --- | --- |
| Seats cannot be oversold (6.2, 6.3) | `reserveInventory` conditional `UPDATE … allocated + n <= capacity`; CHECK `ticket_tiers_allocation`; QA CI-01 (14 Oct) | Implemented; concurrency test historical |
| ≤ 4 tickets per person (5.3) | `MAX_TICKETS_PER_PERSON`, `events_max_per_booking` CHECK (migration 0007), unit test "platform limit" | Implemented and unit-tested (15 Oct) |
| Paid bookings approved after verified payment (6.4) | `confirmPayment` → `transitionBooking(awaiting_payment → approved)` | Implemented |
| Successful payment unlocks tickets (6.4, 6.5) | `ticketsShouldBeValid`; PDF route re-checks | Implemented |
| QR check-in admits once (6.6) | `onConflictDoNothing({ target: checkIns.ticketId })` | Implemented; concurrency test historical |
| Secure ticket download (6.5) | `/api/tickets/[bookingId]` owner/organizer/admin check; private `tickets` bucket | Implemented |
| RLS on all 17 tables (6.7) | Live catalogue query 15 Oct 2026: 17 tables, all `relrowsecurity = t` | Verified |
| Administrators only via CLI script (3.2 Table 3.1, 4.6, 7.4) | `scripts/create-admin.ts` **and** root-admin rule in `handle_new_user` / `getCurrentUser` | **Outdated**: root admin also obtained by e-mail match |
| "All eight migrations" (7.3, 7.9) | `drizzle/` has 9 SQL files (0000–0008); Drizzle journal records 8 on the hosted DB; 0008 triggers present (applied manually) | **Outdated** |
| OBS-1 admin hang "Open" (8.7) | `max_pipeline: 0` in `src/db/index.ts` (fix measured 15 Oct: 200/200 queries vs 91/200 timeouts) | **Outdated**: fixed |
| OBS-2 passwords in dev log "Open" (8.7) | `logging.serverFunctions: false` in `next.config.ts` | **Outdated**: fixed |
| OBS-3 leftover test events (8.7) | Read-only query 15 Oct: 19 published "Integration Test Event" rows | Still open (accurate) |
| Unit tests 59/59, lint 21 warnings (8.3, 8.7, 11.3) | New run 15 Oct 2026 15:26 IST: 63/63, lint 0 errors/3 warnings, build OK (46 routes) | **Outdated**: superseded by new run |
| Production build not repeated (8.7) | Build re-run 15 Oct 2026 15:26 IST (exit 0) | **Outdated** |
| Open redirect / seed defect (not in report) | `safeRedirectPath` in `src/lib/url.ts` + unit tests; `scripts/seed.ts` fix | **Missing** from defect table |

## 6. Report sections reviewed

All sections of the current report: cover, bonafide certificate, acknowledgement, TOC, abstract, lists of tables/figures, chapters 1–9, references (32), appendices 11.1–11.5. **Not present** in the report and not required by the template: declaration, feasibility study, separate hardware/software requirements, UML diagrams beyond DFD/ER/state/flow. These are not added, because the brief says not to invent sections without institutional evidence (*NEEDS STUDENT/GUIDE CONFIRMATION* whether SRM requires them).

## 7. Findings

1. **Self-similarity with the team's Electify report.** 8.1 % of the report's 7-word sequences (842 / 10,364) also occur in the Electify report: 226 in the front matter, 309 in shared references, 307 in about 45 body sentences. The acknowledgement is word-for-word identical to Electify's. Details: `ORIGINALITY_ISSUE_REPORT.md`.
2. **Outdated technical statements** (§5 above): admin provisioning, migration count, defect status, test results, build status.
3. **Citation style.** References are not numbered in order of first citation (IEEE convention): [22] and [27] are cited early.
4. **Newer editions exist** for four cited standards (OWASP Top 10, ASVS, NIST SP 800-63B, ISO/IEC 18004). See `REFERENCE_AUDIT.md`.
5. **AI assistance.** The report text, figures and the earlier tooling were drafted with an AI assistant (Claude) during development sessions in this repository. Whether SRM requires an AI-use declaration is *NEEDS STUDENT/GUIDE CONFIRMATION*.
6. **No similarity-checker result exists**; no score can be claimed.

## 8. Revision plan

| Category | Action |
| --- | --- |
| Immediate (done in this task) | Rewrite the ~45 overlapping body sentences in project-specific language; rewrite the acknowledgement with the same people and roles; update every outdated claim; add the root-admin rule, migration 0008 and the fixed defects; replace test evidence with the 15 Oct 15:26 run, keeping the 14 Oct QA results labelled historical; renumber references in order of first citation and use edition-specific URLs |
| Source-code investigation | None needed. The code was only read, never changed. Observation: the root-admin grant depends on Supabase e-mail confirmation staying enabled (documented as a limitation). |
| Citations needing verification | Newer editions of [OWASP Top 10, ASVS, NIST SP 800-63B, ISO/IEC 18004]; decide whether to cite the edition consulted or the latest |
| Missing input from the student | Confirmation of the title; academic year; acknowledgement wording; whether a declaration page and AI-use disclosure are required |
| Institutional confirmation | Citation style (IEEE assumed, as in the template); the institution's approved similarity checker and threshold |

**Not changed:** application source code, database, migrations, figures (still accurate), the cover page, the bonafide certificate wording (prescribed text), and the original report file.
