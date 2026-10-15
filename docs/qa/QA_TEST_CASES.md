# EventDeck — QA Test Cases

Legend — **Status**: ✅ automated & passing · 🔧 manual check done · ⚠ manual check still required · ⛔ not implemented.
**Where**: `U` = `tests/unit/*`, `I` = `tests/integration/*`, `E` = `e2e/*`.

## A. Authentication & roles

| ID | Case | Expected | Where | Status |
| --- | --- | --- | --- | --- |
| A-01 | Guest signup via 4-step wizard | Account created as `participant`, lands on /events | E `roles.spec`, helper `signUp` | ✅ |
| A-02 | SRM student signup requires `@srmist.edu.in` | Non-SRM email rejected by server validation | U/I `auth-authorization`, E `audience.spec` | ✅ |
| A-03 | **Direct Supabase Auth signup claiming SRM student with Gmail** | Classified as Guest, never SRM student / never admin | I `eligibility-bypass` (QA-001) | ✅ |
| A-04 | Direct signup with no metadata | Not defaulted to SRM student | I `eligibility-bypass` | ✅ |
| A-05 | Role in signup metadata (`role: admin`) | Ignored; role = participant | I `eligibility-bypass`, `auth-authorization` | ✅ |
| A-06 | Sign-in / redirect to role home | Correct dashboard | E all specs (`signIn`) | ✅ |
| A-07 | Session survives refresh | Protected page still renders | E `quality.spec` | ✅ |
| A-08 | Expired/cleared session on protected page | Redirect to `/login?next=…` | E `quality.spec`, `public.spec` | ✅ |
| A-09 | Recovery token → reset → sign in | New password works | E `password-reset.spec` (admin-generated token; no email) | ✅ (ran on the earlier local stack; re-run pending a Supabase test project) |
| A-10 | Forgot password with unknown email | No account enumeration message | E `password-reset.spec` | ✅ |
| A-11 | Deactivated account | Cannot sign in; cannot scan | I `auth-authorization`, `moderators` | ✅ |

## B. Permission matrix (server-enforced)

Each row tested for an **authorized** user, an **authenticated unauthorized** user, **anonymous**, **another organizer**, and a **direct API call**.

| ID | Action | Allowed | Denied (tested) | Where | Status |
| --- | --- | --- | --- | --- | --- |
| B-01 | Admin console pages | admin | participant → /forbidden; anon → /login | E `roles`, `public`, `quality` | ✅ |
| B-02 | Organizer console | organizer, admin | participant/moderator → /forbidden | E `roles`, `moderators` | ✅ |
| B-03 | Manage someone else's event | owner, admin | other organizer → 404; CSV → 403 | E `roles`, I `booking-engine` | ✅ |
| B-04 | Approve/reject bookings | owner, admin | other organizer, participant, moderator | I `booking-engine`, `moderators` | ✅ |
| B-05 | Assign / revoke moderators | owner, admin | other organizer, participant, the moderator themself | I `moderators` | ✅ |
| B-06 | Scan / check-in | owner, admin, **active moderator of that event** | unassigned user, moderator of other event, revoked, deactivated, anon (401) | I `moderators`, E `moderators`, `public` | ✅ |
| B-07 | Download ticket PDF | owner, admin | other participant → 404 | E `booking.spec` | ✅ |
| B-08 | Create order / mark failed for a booking | owner | other user (ID tampering) | I `api-security` | ✅ |
| B-09 | CSV reports | admin; organizer for own event | participant 403, anon 401 | E `roles`, `public`, `moderators` | ✅ |
| B-10 | PostgREST with user JWT: read others' rows | — | bookings/payments/tickets/check_ins/refunds/moderators/audit all empty | I `api-security` | ✅ |
| B-11 | PostgREST writes (self-promote, forge moderator, approve booking) | — | all rejected; DB unchanged | I `api-security` | ✅ |
| B-12 | Webhook with bad signature | — | 401, no state change | I `webhook-route`, E `public` | ✅ |

## C. Organizer → moderators → check-in (critical workflow)

| ID | Case | Expected | Where | Status |
| --- | --- | --- | --- | --- |
| C-01 | Organizer adds **four** moderators by email (UI) | 4 active, each notified | E `moderators.spec`, I `moderators` | ✅ |
| C-02 | Duplicate / unknown email / owner / invalid email | Specific inline errors | E + I `moderators` | ✅ |
| C-03 | Cap of 10 active moderators | 11th refused | I `moderators` | ✅ |
| C-04 | Moderator sees "Check-in" nav and only assigned events | Unassigned events absent | E `moderators.spec` | ✅ |
| C-05 | Moderator scans valid ticket | "Welcome in", attendee name/tier/number | E `moderators.spec` | ✅ |
| C-06 | Same ticket again | "Already checked in … by <moderator>" | E + I | ✅ |
| C-07 | **Two moderators scan the same ticket simultaneously** | Exactly one `checked_in` | I (4 concurrent calls), E (two browser sessions) | ✅ |
| C-08 | Ticket from another event | "This ticket is for a different event." | E + I | ✅ |
| C-09 | Tampered / random / JSON-forged QR payload | Invalid; nothing trusted from QR | I `moderators` | ✅ |
| C-10 | Ticket of a cancelled event | Invalid | I `moderators` | ✅ |
| C-11 | Outside check-in window | "Outside check-in window" | I `booking-engine` | ✅ |
| C-12 | Moderator opens organizer pages / reports | /forbidden, 403 | E `moderators.spec` | ✅ |
| C-13 | Revoke moderator → next scan | 403 / 404, list shows "Removed" | E + I | ✅ |
| C-14 | Check-ins attributed to moderator in attendance + CSV | "by <name>" | E `moderators.spec`, I | ✅ |
| C-15 | **Real QR decoded from a camera feed** | Checked in; re-scan refused | E `camera.spec` (Chromium fake webcam playing a QR video) | ✅ |
| C-16 | Camera denied/unavailable | Recovery message + manual entry works | E `quality.spec` | ✅ |
| C-17 | Physical phone camera over HTTPS | Scans | — | ⚠ Requires a deployed HTTPS URL + phone |

## D. Event lifecycle & ticketing

| ID | Case | Expected | Where | Status |
| --- | --- | --- | --- | --- |
| D-01 | Create (draft/publish), edit, unpublish | Persisted; appears/disappears from discovery | E `organizer.spec` | ✅ |
| D-02 | Invalid dates / tiers / capacities | Inline errors; server re-validates | U `domain`, I | ✅ |
| D-03 | Paid multi-tier booking → decline → retry → success → approval → QR + PDF | Tickets valid only after payment **and** approval | E `booking.spec` | ✅ |
| D-04 | Free registration → rejection with reason | Participant sees reason | E `booking.spec` | ✅ |
| D-05 | Duplicate submission (same idempotency key) | One booking | I `booking-engine` | ✅ |
| D-06 | 20 concurrent buyers for 5 seats | Exactly 5 succeed | I `booking-engine` | ✅ |
| D-07 | Registration after deadline / over limit / ineligible | Refused | I `booking-engine`, `moderators` | ✅ |
| D-08 | 10-minute hold expiry, concurrent sweeps | Released exactly once | I `booking-engine` | ✅ |
| D-09 | Late payment (seats free / gone) | Recovered / payment exception, never a ticket | I `booking-engine` | ✅ |
| D-10 | Event cancellation → tickets invalid → refunds processed | Statuses + notifications | I `booking-engine`, E `admin.spec` | ✅ |
| D-11 | Waitlist promotion | — | — | ⛔ Not implemented |

## E. Multi-campus & external institutions

| ID | Case | Expected | Where | Status |
| --- | --- | --- | --- | --- |
| E-01 | KTR-only event: KTR ✓, Ramapuram ✗, VIT ✗, guest ✗ | Server refuses with specific reason | I `moderators` (audience block), U `eligibility`, E `audience.spec` | ✅ |
| E-02 | Inter-campus (KTR + Ramapuram): Vadapalani ✗ | Refused | I + U | ✅ |
| E-03 | Inter-college approved list (VIT, Anna University): both ✓ (name normalised), Loyola ✗, SRM ✓, guest ✗ | As configured | I + U | ✅ |
| E-04 | Open event: everyone ✓ | Accepted | I + U | ✅ |
| E-05 | Client tampering (extra `institutionType`/`campus`/`category`/`userId` in request) | Stripped; server uses stored profile | U `eligibility` | ✅ |
| E-06 | External user edits profile to "SRM student" | Refused (QA-002) | I `eligibility-bypass` | ✅ |
| E-07 | Discovery audience filter & labels | `SRM only` / `Inter-college` / `Open to all` accurate | I, E `audience.spec` | ✅ |
| E-08 | Campus *within* SRM is self-declared | Organizer verification is the control | — | ⚠ Business-rule risk (see final report) |
| E-09 | Invite-only events | — | — | ⛔ Not implemented (unlisted = link-only, rules still enforced) |

## F. Payments & email

| ID | Case | Expected | Where | Status |
| --- | --- | --- | --- | --- |
| F-01 | Server-priced order; client price ignored | Amount from DB | I `booking-engine` | ✅ |
| F-02 | Checkout signature verify (good/tampered/empty) | Only valid accepted | U `security` | ✅ |
| F-03 | Webhook dedupe + idempotent capture | One confirmation | I `webhook-route`, `booking-engine` | ✅ |
| F-04 | Live keys refused; simulator disabled on production | Guarded | U `security` | ✅ |
| F-05 | Razorpay Test API order creation with configured keys | ₹1 test order created | 🔧 one-off probe (not in suite) | 🔧 |
| F-06 | Razorpay Checkout modal with test card in a browser | Paid booking | — | ⚠ Manual (third-party modal) |
| F-07 | Password-reset email delivery | Email received with working link | — | ⚠ Manual on hosted Supabase (free SMTP is restricted/rate-limited) |
| F-08 | Hosted Supabase email delivery | — | — | ⚠ Manual; free tier is rate-limited |

## G. UI / UX quality

| ID | Case | Where | Status |
| --- | --- | --- | --- |
| G-01 | No console errors / page errors / 5xx across all participant, organizer, admin pages and all event sub-pages | E `quality.spec` | ✅ |
| G-02 | Phone (Pixel 7) and tablet (820×1180): no horizontal scroll; correct nav pattern | E `mobile.spec` ×2 projects | ✅ |
| G-03 | Keyboard: skip link → main, tabbable nav | E `quality.spec` | ✅ |
| G-04 | Empty states (no bookings, no moderators, no assignments, no results) | E (several) | ✅ |
| G-05 | Long attendee lists | Attendance table has no pagination | ⚠ P3 (see final report) |
