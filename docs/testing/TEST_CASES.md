# EventDeck — Detailed Test Case Specification Matrix

> **Document Status:** Authoritative Functional Test Case Inventory  
> **Initial Execution Status Legend:**  
> - `✅ Automated & Passing`: Verified by automated suite (`npm run test:unit`, `vitest`, or `playwright`).  
> - `🔧 Verified Manual`: Manually verified in development environment.  
> - `⏳ Not Run`: Pre-configured test case awaiting manual or staging test execution.  
> - `⛔ Blocked`: Requires external infrastructure (e.g. physical camera device or deployed webhook URL).

---

## Summary Matrix by Module

| Module Code | Module Description | Total Cases | Critical | High | Medium | Automated / Verified | Not Run / Blocked |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **AUTH** | Authentication, Onboarding & Sessions | 10 | 4 | 4 | 2 | 8 | 2 |
| **ROLE** | Role Enforcement, RLS & Authorization | 8 | 5 | 2 | 1 | 8 | 0 |
| **EVENT** | Event Lifecycle, Tiers & Eligibility | 8 | 3 | 4 | 1 | 7 | 1 |
| **BOOK** | Booking Engine, Inventory & Holds | 8 | 5 | 3 | 0 | 8 | 0 |
| **PAY-CARD** | Razorpay Test Card Payments | 6 | 3 | 2 | 1 | 2 | 4 |
| **PAY-NB** | Razorpay Indian Netbanking Simulation | 4 | 2 | 2 | 0 | 0 | 4 |
| **PAY-UPI** | Razorpay UPI Simulation | 2 | 1 | 1 | 0 | 0 | 2 |
| **PAY-FAIL**| Payment Interruption, Decline & Recovery | 6 | 3 | 2 | 1 | 4 | 2 |
| **TICKET** | Ticket Generation, QR & PDF Access | 5 | 3 | 2 | 0 | 5 | 0 |
| **SCAN** | Door Check-in & Scanner Validation | 7 | 4 | 2 | 1 | 6 | 1 |
| **MOD** | Moderator Delegation & Scoped Access | 6 | 3 | 2 | 1 | 6 | 0 |
| **ADMIN** | Admin Operations, Refunds & Payouts | 8 | 4 | 3 | 1 | 6 | 2 |
| **SEC** | Data Tampering & Security Negative Tests | 6 | 4 | 2 | 0 | 6 | 0 |
| **TOTAL** | **All Modules** | **84** | **44** | **29** | **11** | **66** | **18** |

---

## 1. Module AUTH: Authentication, Onboarding & Sessions

### TC-AUTH-001: Standard Participant Registration via 4-Step Wizard
- **Module:** Authentication
- **Role:** Participant (Anonymous Visitor)
- **Priority:** Critical
- **Preconditions:** User is signed out. Application is accessible at `/signup`.
- **Test Data:** Name: `Rahul Kumar`, Email: `rahul.test@eventdeck.test`, Password: `Password123!`
- **Steps:**
  1. Open `/signup`.
  2. Complete Step 1: enter Name, Email, Password, and Confirm Password. Click *Continue*.
  3. Complete Step 2 (Origin): select *SRM University*.
  4. Complete Step 3 (Affiliation): select Campus *KTR*, Affiliation *Student*, Department *Computer Science*. Click *Review details*.
  5. Complete Step 4: verify summary and click *Create account*.
- **Expected Result:** Account is registered with `role: participant`. Session cookie is established. User is redirected to `/events` with active user menu displaying name.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

### TC-AUTH-002: SRM Student Email Domain Enforcement
- **Module:** Authentication
- **Role:** Participant (Anonymous Visitor)
- **Priority:** High
- **Preconditions:** User visits `/signup`.
- **Test Data:** Email: `fraud.student@gmail.com`, claiming SRM affiliation.
- **Steps:**
  1. Complete Step 1 with a `@gmail.com` address.
  2. Select *SRM University* and Affiliation *Student*.
  3. Submit form.
- **Expected Result:** Server rejects submission with error: *"SRM students and staff need an official SRM email (@srmist.edu.in)"*. Account is not created as SRM student.
- **Status:** ✅ Automated & Passing (`tests/unit/auth-onboarding.test.ts`, `tests/integration/eligibility-bypass.test.ts`)

### TC-AUTH-003: Login with Valid Credentials and Role-Based Redirection
- **Module:** Authentication
- **Role:** Admin / Organizer / Participant
- **Priority:** Critical
- **Preconditions:** Accounts pre-seeded via `npm run db:seed`.
- **Test Data:** `admin@eventdeck.test`, `organizer@eventdeck.test`, `participant@eventdeck.test`
- **Steps:**
  1. Navigate to `/login`.
  2. Log in with `admin@eventdeck.test`. Verify redirection.
  3. Log out. Log in with `organizer@eventdeck.test`. Verify redirection.
  4. Log out. Log in with `participant@eventdeck.test`. Verify redirection.
- **Expected Result:**
  - Admin lands on `/admin`.
  - Organizer lands on `/organizer`.
  - Participant lands on `/my/bookings`.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

### TC-AUTH-004: Session Survival Across Page Reloads and Navigation
- **Module:** Authentication
- **Role:** Participant
- **Priority:** High
- **Preconditions:** User logged in as `participant@eventdeck.test`.
- **Steps:**
  1. Navigate to `/my/bookings`.
  2. Perform hard reload (`Ctrl+F5` / `Cmd+Shift+R`).
  3. Navigate to `/events` and back to `/my/profile`.
- **Expected Result:** Session remains authenticated; user is not redirected to `/login`; SSR cookies persist.
- **Status:** ✅ Automated & Passing (`e2e/quality.spec.ts`)

### TC-AUTH-005: Unauthenticated Access to Protected Routes
- **Module:** Authentication
- **Role:** Anonymous Visitor
- **Priority:** Critical
- **Preconditions:** User is signed out.
- **Steps:**
  1. Attempt direct navigation to `/admin`.
  2. Attempt direct navigation to `/organizer`.
  3. Attempt direct navigation to `/my/bookings`.
  4. Attempt direct navigation to `/moderate`.
- **Expected Result:** `src/proxy.ts` intercepts each request and redirects to `/login?next=<encoded-path>`.
- **Status:** ✅ Automated & Passing (`e2e/public.spec.ts`)

### TC-AUTH-006: Password Recovery Email Request (No Enumeration)
- **Module:** Authentication
- **Role:** Anonymous Visitor
- **Priority:** Medium
- **Preconditions:** User visits `/forgot-password`.
- **Test Data:** Nonexistent email: `random_unknown_person_9999@domain.org`
- **Steps:**
  1. Enter nonexistent email address and click *Send reset link*.
- **Expected Result:** UI displays generic success message: *"If an account exists for that email, a password reset link has been sent"*. No email enumeration occurs.
- **Status:** ✅ Automated & Passing (`e2e/password-reset.spec.ts`)

### TC-AUTH-007: Password Reset via Recovery Link
- **Module:** Authentication
- **Role:** Participant
- **Priority:** High
- **Preconditions:** Valid recovery link or session on `/reset-password`.
- **Test Data:** New password: `NewPassword2026!Aa1`
- **Steps:**
  1. Visit `/reset-password`.
  2. Enter new password and confirmation. Submit form.
  3. Sign in with the new password.
- **Expected Result:** Password is successfully updated in Supabase Auth; user signs in with new password.
- **Status:** ⏳ Not Run (Manual on staging / automated in earlier local stack)

### TC-AUTH-008: Deactivated Account Sign-in Block
- **Module:** Authentication
- **Role:** Deactivated User
- **Priority:** Critical
- **Preconditions:** User `applicant@eventdeck.test` has been deactivated by Admin.
- **Steps:**
  1. Attempt to sign in at `/login` with credentials for deactivated account.
- **Expected Result:** Login fails with message: *"This account has been deactivated. Contact an administrator."* Session is rejected.
- **Status:** ✅ Automated & Passing (`tests/integration/auth-authorization.test.ts`)

### TC-AUTH-009: Invalid Password Error Feedback
- **Module:** Authentication
- **Role:** Registered User
- **Priority:** Medium
- **Steps:**
  1. Go to `/login`.
  2. Enter correct email `participant@eventdeck.test` with incorrect password `WrongPass123!`.
- **Expected Result:** Error alert displays *"Incorrect email or password."* User remains on login screen.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

### TC-AUTH-010: Logout Terminates Authenticated Session
- **Module:** Authentication
- **Role:** Any Authenticated User
- **Priority:** High
- **Steps:**
  1. Click User Menu in navbar → Click *Sign out*.
  2. Attempt to press browser *Back* button to return to `/my/bookings`.
- **Expected Result:** User is signed out. Submitting any protected action redirects to `/login`.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

---

## 2. Module ROLE: Role Enforcement, RLS & Authorization

### TC-ROLE-001: Participant Blocked from Administration Console
- **Module:** Role Authorization
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Logged in as `participant@eventdeck.test`.
- **Steps:**
  1. Enter URL `http://localhost:3000/admin` in address bar.
- **Expected Result:** Server-side guard in `src/app/admin/layout.tsx` intercepts request and redirects to `/forbidden`. UI shows *"Not for this account"*.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

### TC-ROLE-002: Participant Blocked from Organizer Console
- **Module:** Role Authorization
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Logged in as `participant@eventdeck.test`.
- **Steps:**
  1. Enter URL `http://localhost:3000/organizer` in address bar.
- **Expected Result:** Guard in `src/app/organizer/layout.tsx` redirects to `/forbidden`.
- **Status:** ✅ Automated & Passing (`e2e/roles.spec.ts`)

### TC-ROLE-003: Organizer Cannot Modify Another Organizer's Event
- **Module:** Role Authorization
- **Role:** Organizer (`cultural@eventdeck.test`)
- **Priority:** Critical
- **Preconditions:** Event `SRM Hackathon 2026` is owned by `organizer@eventdeck.test`.
- **Steps:**
  1. Log in as `cultural@eventdeck.test`.
  2. Attempt to access `/organizer/events/<hackathon-id>/edit`.
  3. Attempt to submit `updateEventAction` via direct server invocation.
- **Expected Result:** UI returns 404 Not Found. Direct server action throws `DomainError("Event not found", "not_found")`. No modifications occur.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`, `e2e/roles.spec.ts`)

### TC-ROLE-004: Direct PostgREST Read with Participant JWT
- **Module:** Role Authorization / Supabase RLS
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Valid participant Supabase JWT.
- **Steps:**
  1. Execute PostgREST query to `/rest/v1/payments` with participant JWT.
  2. Execute PostgREST query to `/rest/v1/audit_logs` with participant JWT.
- **Expected Result:** RLS policies return empty arrays (`[]`) for unowned rows. No sensitive payment or audit data is exposed.
- **Status:** ✅ Automated & Passing (`tests/integration/api-security.test.ts`)

### TC-ROLE-005: PostgREST Write Prevention (Self-Promotion)
- **Module:** Role Authorization / Supabase RLS
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Valid participant Supabase JWT.
- **Steps:**
  1. Send direct `PATCH` request to `/rest/v1/profiles?id=eq.<user-id>` attempting `{"role":"admin"}`.
- **Expected Result:** Request rejected with HTTP 403 / 401; database row remains `role: participant`.
- **Status:** ✅ Automated & Passing (`tests/integration/api-security.test.ts`)

### TC-ROLE-006: Permanent Root Admin Protection
- **Module:** Role Authorization
- **Role:** Administrator (`admin@eventdeck.test`)
- **Priority:** Critical
- **Preconditions:** Logged in as admin. Root admin `eventdeck88@gmail.com` exists.
- **Steps:**
  1. Call `setUserRoleAction` targeting `eventdeck88@gmail.com` with role `participant`.
  2. Call `setUserActiveAction` targeting `eventdeck88@gmail.com` with `active: false`.
- **Expected Result:** Both actions fail with message: *"Root administrator account is permanent and cannot be modified."*
- **Status:** ✅ Automated & Passing (`tests/unit/security.test.ts`)

### TC-ROLE-007: Admin Cannot Elevate Ordinary User to Admin via Web UI
- **Module:** Role Authorization
- **Role:** Administrator
- **Priority:** High
- **Preconditions:** Logged in as admin on `/admin/users`.
- **Steps:**
  1. Inspect role dropdown options for any user.
  2. Attempt to submit a request with `role: "admin"`.
- **Expected Result:** Role options are strictly limited to `Participant` and `Organizer`. Admin creation is only permitted via CLI `npm run admin:create`.
- **Status:** ✅ Automated & Passing (`tests/integration/auth-authorization.test.ts`)

### TC-ROLE-008: Unassigned User Blocked from Event Scanner
- **Module:** Role Authorization
- **Role:** Participant / Unassigned Moderator
- **Priority:** High
- **Steps:**
  1. Log in as `participant@eventdeck.test` (not assigned to event `Orientation Mixer`).
  2. Access `/moderate/<mixer-id>`.
- **Expected Result:** Page returns 404 Not Found. Direct call to `/api/checkin` returns HTTP 403 *"You're not a check-in moderator for this event."*
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`)

---

## 3. Module EVENT: Event Lifecycle, Tiers & Eligibility

### TC-EVENT-001: Organizer Creates Draft Event with Multiple Tiers
- **Module:** Event Management
- **Role:** Organizer
- **Priority:** Critical
- **Preconditions:** Logged in as `organizer@eventdeck.test`.
- **Steps:**
  1. Navigate to `/organizer/events/new`.
  2. Fill in Title: `SRM AI Summit 2026`, Summary, Venue, Category *Technical*.
  3. Set Dates: Start in 7 days, End in 7 days + 4 hours.
  4. Configure Tiers:
     - Tier 1: `Standard Entry`, Price: ₹0, Capacity: 100.
     - Tier 2: `VIP Pass`, Price: ₹499, Capacity: 25.
  5. Click *Save draft*.
- **Expected Result:** Event created with `status: draft`. Event does not appear in public discovery (`/events`).
- **Status:** ✅ Automated & Passing (`e2e/organizer.spec.ts`)

### TC-EVENT-002: Publishing and Unpublishing an Event
- **Module:** Event Management
- **Role:** Organizer
- **Priority:** High
- **Steps:**
  1. Open draft event dashboard. Click *Publish event*.
  2. Navigate to public `/events` page. Verify event appears.
  3. Return to event dashboard. Click *Unpublish event*.
  4. Re-check `/events` page.
- **Expected Result:** Event transitions to `published` and appears in public feed. Upon unpublishing, event disappears from public feed immediately.
- **Status:** ✅ Automated & Passing (`e2e/organizer.spec.ts`)

### TC-EVENT-003: Poster Upload Magic-Byte Validation
- **Module:** Event Management
- **Role:** Organizer
- **Priority:** High
- **Steps:**
  1. Attempt to upload a text file or SVG renamed to `.jpg` as event poster.
  2. Attempt to upload a valid PNG image (> 2MB).
  3. Upload a valid PNG image (< 2MB).
- **Expected Result:** Fake extension is rejected by magic byte inspection (`sniffImageType`); file > 2MB rejected; valid PNG accepted and uploaded to `posters` bucket.
- **Status:** ✅ Automated & Passing (`tests/unit/security.test.ts`)

### TC-EVENT-004: Multi-Campus Audience Restriction Enforcement
- **Module:** Event Management / Eligibility
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Event configured with `eligibleCampuses: ['KTR']`.
- **Test Data:** User 1 from KTR campus; User 2 from Ramapuram campus.
- **Steps:**
  1. User 1 (KTR) books ticket → verify result.
  2. User 2 (Ramapuram) attempts booking → verify result.
- **Expected Result:** User 1 booking accepted; User 2 booking refused with message: *"This event is only open to SRM KTR campus students and staff"*.
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`, `tests/unit/eligibility.test.ts`)

### TC-EVENT-005: Approved External Institutions Restriction
- **Module:** Event Management / Eligibility
- **Role:** Participant
- **Priority:** High
- **Preconditions:** Event allows `EXTERNAL_INSTITUTION` with `eligibleInstitutions: ['VIT', 'Anna University']`.
- **Steps:**
  1. User from `VIT University` books ticket.
  2. User from `Loyola College` attempts booking.
- **Expected Result:** VIT user accepted (case/spacing normalized); Loyola user rejected with specific institution exclusion message.
- **Status:** ✅ Automated & Passing (`tests/unit/eligibility.test.ts`)

### TC-EVENT-006: Registration Deadline Enforcement
- **Module:** Event Management
- **Role:** Participant
- **Priority:** High
- **Preconditions:** Event `registrationClosesAt` set in the past.
- **Steps:**
  1. Open event details page.
  2. Attempt to submit booking.
- **Expected Result:** Booking button disabled with *"Registration closed"*; direct API invocation returns `DomainError("Registration for this event has closed", "closed")`.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-EVENT-007: Event Search & Full-Text Indexing
- **Module:** Event Discovery
- **Role:** Anonymous / Participant
- **Priority:** Medium
- **Steps:**
  1. Go to `/events`.
  2. Enter keyword search (e.g., `Hackathon` or `Fusion`).
  3. Apply category filter `Cultural`.
- **Expected Result:** PostgreSQL tsvector search returns ranked results matching title, summary, or venue.
- **Status:** ✅ Automated & Passing (`e2e/public.spec.ts`)

### TC-EVENT-008: Unlisted Event Direct Link Access
- **Module:** Event Discovery
- **Role:** Anonymous / Participant
- **Priority:** Medium
- **Preconditions:** Event configured with `visibility: unlisted`.
- **Steps:**
  1. Verify event is absent from `/events` public list.
  2. Navigate directly to `/events/<unlisted-slug>`.
- **Expected Result:** Event is not listed in public catalog, but renders correctly via direct URL link.
- **Status:** ⏳ Not Run (Manual check done on local stack)

---

## 4. Module BOOK: Booking Engine, Inventory & Holds

### TC-BOOK-001: Free Event Single-Ticket Booking (Instant Approval)
- **Module:** Booking Engine
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Published event with ₹0 ticket tier.
- **Steps:**
  1. Navigate to event page. Select 1 ticket (₹0). Click *Request registration*.
- **Expected Result:** Booking created with `status: approved`, `payment_status: not_required`. Unique ticket and QR token issued immediately.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-BOOK-002: Paid Ticket Reservation (10-Minute Hold)
- **Module:** Booking Engine
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Published paid event with available seats.
- **Steps:**
  1. Select 2 tickets of ₹249 tier. Click *Reserve & pay ₹498*.
- **Expected Result:** Booking created with `status: awaiting_payment`, `payment_status: pending`. `ticket_tiers.allocated` increments by 2. 10-minute countdown timer displays on `/my/bookings/[id]`.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-BOOK-003: Participant Cancels Unpaid Reservation
- **Module:** Booking Engine
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. On `/my/bookings/[id]`, click *Cancel booking* → confirm in modal.
- **Expected Result:** Booking status transitions to `cancelled`. Held seats in `ticket_tiers.allocated` are released immediately.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-BOOK-004: Hold Expiration and Seat Release
- **Module:** Booking Engine
- **Role:** System / Participant
- **Priority:** Critical
- **Preconditions:** Booking in `awaiting_payment` with expired `expiresAt`.
- **Steps:**
  1. Trigger hold expiry via read or `/api/cron/expire-holds`.
- **Expected Result:** Booking transitions to `expired`. `ticket_tiers.allocated` decrements by booked quantity.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-BOOK-005: Concurrency Safety: 20 Simultaneous Buyers for 5 Seats
- **Module:** Booking Engine
- **Role:** Automated Concurrency Probe
- **Priority:** Critical
- **Preconditions:** Ticket tier with exactly 5 capacity.
- **Steps:**
  1. Execute 20 concurrent booking requests simultaneously.
- **Expected Result:** Exactly 5 bookings succeed (`allocated = 5`); exactly 15 bookings fail with *"Not enough tickets available"*. Overselling is strictly prevented.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-BOOK-006: Maximum Tickets Per Person Platform Limit (Cap = 4)
- **Module:** Booking Engine
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. Attempt to book 5 tickets for a single event in one request.
  2. Book 3 tickets, then submit another request for 2 tickets.
- **Expected Result:** Single request of 5 tickets rejected by validation; second request rejected by server-side cumulative cap check (`MAX_TICKETS_PER_PERSON = 4`).
- **Status:** ✅ Automated & Passing (`tests/unit/domain.test.ts`, `tests/integration/booking-engine.test.ts`)

### TC-BOOK-007: Complimentary Pass Request & Organizer Review
- **Module:** Booking Engine
- **Role:** Participant & Organizer
- **Priority:** High
- **Steps:**
  1. Participant requests complimentary pass with justification: *"Guest speaker mentor"*.
  2. Verify booking status is `pending_verification`.
  3. Organizer opens `/organizer/events/[id]/bookings`, reviews note, and clicks *Approve*.
- **Expected Result:** Booking transitions to `approved`. Tickets issued with status `valid`. Participant receives notification.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-BOOK-008: Complimentary Pass Rejection with Reason
- **Module:** Booking Engine
- **Role:** Participant & Organizer
- **Priority:** High
- **Steps:**
  1. Participant submits pass request.
  2. Organizer clicks *Reject* and enters reason: *"Venue capacity reserved for presenters"*.
- **Expected Result:** Booking transitions to `rejected`. Participant sees rejection reason on `/my/bookings/[id]`. Held seats are released.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

---

## 5. Module PAY-CARD: Razorpay Test Card Payments

### TC-PAY-CARD-001: Successful Domestic Visa Credit Card Payment
- **Module:** Razorpay Payments
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** `RAZORPAY_KEY_ID` configured in test mode (`rzp_test_…`). Paid event reservation created.
- **Test Data:** Card: `4100 2800 0000 1007`, Expiry: `12/28`, CVV: `123`, OTP: `123456`
- **Steps:**
  1. On `/my/bookings/[id]`, click *Pay ₹...*.
  2. In Razorpay modal, select *Card*.
  3. Enter test card details. Click *Pay Now*.
  4. On mock bank screen, enter OTP `123456` and click *Submit* (or click *Success*).
- **Expected Result:** Payment succeeds. Server verifies signature at `/api/payments/verify`. Booking status updates to `approved`, payment to `paid`. Tickets rendered with QR codes.
- **Status:** ⏳ Not Run (Requires manual run with configured Razorpay test credentials; simulated in `e2e/booking.spec.ts`)

### TC-PAY-CARD-002: Successful Domestic Mastercard Payment
- **Module:** Razorpay Payments
- **Role:** Participant
- **Priority:** High
- **Test Data:** Card: `5555 5100 0008 1006`, Expiry: `10/28`, CVV: `789`
- **Steps:**
  1. Initiate payment for held booking.
  2. Enter Mastercard test card details.
  3. Complete payment on mock bank screen with *Success*.
- **Expected Result:** Order confirmed. `payments.payment_id` recorded. Tickets issued.
- **Status:** ⏳ Not Run

### TC-PAY-CARD-003: Successful Domestic RuPay Payment
- **Module:** Razorpay Payments
- **Role:** Participant
- **Priority:** High
- **Test Data:** Card: `6527 6589 0000 1005`, Expiry: `07/28`, CVV: `321`
- **Steps:**
  1. Complete checkout using RuPay test credentials.
- **Expected Result:** Payment processed and verified via HMAC signature.
- **Status:** ⏳ Not Run

### TC-PAY-CARD-004: Successful Domestic American Express (Amex) Payment
- **Module:** Razorpay Payments
- **Role:** Participant
- **Priority:** Medium
- **Test Data:** Card: `3402 560004 01007`, Expiry: `05/29`, CVV: `1234` (4 digits)
- **Steps:**
  1. Complete checkout entering Amex 4-digit CVV.
- **Expected Result:** Payment succeeds; 4-digit CVV accepted.
- **Status:** ⏳ Not Run

### TC-PAY-CARD-005: Local Payment Simulator (Mock Provider)
- **Module:** Razorpay Payments / Local Simulator
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** `ALLOW_MOCK_PAYMENTS=true`, Razorpay keys unset.
- **Steps:**
  1. On `/my/bookings/[id]`, click *Pay ₹...*.
  2. Test payment simulator modal opens. Click *Simulate success*.
- **Expected Result:** Calls `/api/payments/mock`. Confirms payment and issues tickets identically to Razorpay.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-PAY-CARD-006: Server Signature Verification Rejection (Tampered Signature)
- **Module:** Razorpay Payments
- **Role:** Attacker / Automated Test
- **Priority:** Critical
- **Steps:**
  1. Send POST request to `/api/payments/verify` with invalid `razorpay_signature`.
- **Expected Result:** Server rejects with HTTP 403 / DomainError; audit log records `payment.signature_invalid`; booking remains unpaid.
- **Status:** ✅ Automated & Passing (`tests/unit/security.test.ts`, `tests/integration/api-security.test.ts`)

---

## 6. Module PAY-NB: Razorpay Indian Netbanking Simulation

### TC-PAY-NB-001: Netbanking Success Simulation (SBI)
- **Module:** Razorpay Netbanking
- **Role:** Participant
- **Priority:** Critical
- **Preconditions:** Razorpay Test Mode active. Held booking on `/my/bookings/[id]`.
- **Steps:**
  1. Click *Pay ₹...*. In Razorpay checkout, select *Netbanking*.
  2. Select *SBI (State Bank of India)* from the bank list.
  3. Click *Pay*. Browser opens simulated mock bank screen.
  4. Click the interactive **Success** button.
- **Expected Result:** Browser returns to EventDeck. `/api/payments/verify` validates order. Booking transitions to `approved`.
- **Status:** ⏳ Not Run

### TC-PAY-NB-002: Netbanking Failure Simulation (HDFC)
- **Module:** Razorpay Netbanking
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. Select *Netbanking* → *HDFC Bank*.
  2. On simulated mock bank page, click **Failure**.
- **Expected Result:** Returns to EventDeck. Error message displayed: *"Payment failed. You can try again."* Booking remains in `awaiting_payment`; seats remain held.
- **Status:** ⏳ Not Run

### TC-PAY-NB-003: Netbanking Retry After Failure
- **Module:** Razorpay Netbanking
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. Following failed Netbanking attempt (TC-PAY-NB-002), click *Pay ₹...* again.
  2. Select *ICICI Bank* → click **Success** on mock bank screen.
- **Expected Result:** Retry succeeds without creating a duplicate booking. Status updates to `approved`.
- **Status:** ⏳ Not Run

### TC-PAY-NB-004: Distinguishing Bank Failure from Application Error
- **Module:** Razorpay Netbanking
- **Role:** Participant
- **Priority:** Medium
- **Steps:**
  1. Simulate failure on Netbanking page.
  2. Inspect `/my/bookings/[id]`.
- **Expected Result:** UI explicitly displays payment failure banner without crashing or showing 500 error page. Reservation timer continues ticking.
- **Status:** ⏳ Not Run

---

## 7. Module PAY-UPI: Razorpay UPI Simulation

### TC-PAY-UPI-001: Successful UPI Payment Simulation (`success@razorpay`)
- **Module:** Razorpay UPI
- **Role:** Participant
- **Priority:** Critical
- **Steps:**
  1. Select *UPI* in Razorpay modal.
  2. Enter VPA: `success@razorpay`. Click *Pay*.
- **Expected Result:** Payment completes successfully. Server confirms payment and issues tickets.
- **Status:** ⏳ Not Run

### TC-PAY-UPI-002: Failed UPI Payment Simulation (`failure@razorpay`)
- **Module:** Razorpay UPI
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. Select *UPI* in Razorpay modal.
  2. Enter VPA: `failure@razorpay`. Click *Pay*.
- **Expected Result:** Payment declined. Client receives failure callback; booking remains held.
- **Status:** ⏳ Not Run

---

## 8. Module PAY-FAIL: Payment Interruption, Decline & Recovery

### TC-PAY-FAIL-001: Modal Dismissal / Checkout Interruption
- **Module:** Payment Recovery
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. Open checkout modal.
  2. Click the 'X' button or press Escape.
- **Expected Result:** Modal closes. Toast displays: *"Payment window closed. Your seats stay held until the timer runs out."* Booking remains active in `awaiting_payment`.
- **Status:** ✅ Automated & Passing (`src/components/bookings/checkout-panel.tsx`)

### TC-PAY-FAIL-002: Insufficient Funds Test Card Simulation
- **Module:** Payment Recovery
- **Role:** Participant
- **Priority:** Critical
- **Test Data:** Card: `4100 2800 0008 0001` (Visa decline test card)
- **Steps:**
  1. Enter decline test card details.
  2. Click *Failure* on mock screen.
- **Expected Result:** Payment failure reason `insufficient_fund` is captured. Booking status shows failure banner. Seats remain held for retry.
- **Status:** ⏳ Not Run

### TC-PAY-FAIL-003: Late Payment with Available Seats (Recovery)
- **Module:** Payment Recovery
- **Role:** System / Participant
- **Priority:** Critical
- **Preconditions:** Reservation hold expired, but event seats are still available.
- **Steps:**
  1. A delayed webhook delivery or late payment confirmation arrives for the expired booking.
- **Expected Result:** Server executes `reserveInventory` in a savepoint. Seats are re-allocated. Booking is confirmed with flag `late_payment_recovered`. Tickets are issued.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-PAY-FAIL-004: Late Payment with Sold-Out Seats (Exception Parking)
- **Module:** Payment Recovery
- **Role:** System / Administrator
- **Priority:** Critical
- **Preconditions:** Reservation hold expired and remaining capacity is 0.
- **Steps:**
  1. Late payment arrives for the booking.
- **Expected Result:** Re-allocation fails. Server marks booking as `payment_exception`. Admin receives exception notification (`/admin/exceptions`). No invalid tickets issued.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-PAY-FAIL-005: Webhook Event Deduplication
- **Module:** Payment Webhooks
- **Role:** System
- **Priority:** High
- **Steps:**
  1. Deliver the same `payment.captured` webhook payload twice with identical `x-razorpay-event-id`.
- **Expected Result:** Second delivery returns HTTP 200 with `duplicate: true`. Processing is short-circuited; no duplicate tickets or audit entries created.
- **Status:** ✅ Automated & Passing (`tests/integration/webhook-route.test.ts`)

### TC-PAY-FAIL-006: Webhook Signature Verification Rejection
- **Module:** Payment Webhooks
- **Role:** Attacker
- **Priority:** Critical
- **Steps:**
  1. POST invalid body or signature to `/api/webhooks/razorpay`.
- **Expected Result:** Server returns HTTP 401 Unauthorized. Database state is completely unchanged.
- **Status:** ✅ Automated & Passing (`tests/integration/webhook-route.test.ts`)

---

## 9. Module TICKET: Ticket Generation, QR & PDF Access

### TC-TICKET-001: Unique Ticket Number and 192-bit QR Token
- **Module:** Tickets
- **Role:** Participant
- **Priority:** Critical
- **Steps:**
  1. Complete booking for 3 tickets.
  2. Inspect database `tickets` table.
- **Expected Result:** Exactly 3 tickets created. Each has unique `ticket_number` (format: `EVT-XXXX-XXXX`), unique 24-byte base64url `qr_token`, and attendee name.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`, `tests/integration/booking-engine.test.ts`)

### TC-TICKET-002: PDF Ticket Download with Embedded QR Codes
- **Module:** Tickets
- **Role:** Participant
- **Priority:** High
- **Steps:**
  1. On `/my/bookings/[id]`, click *Download tickets (PDF)*.
- **Expected Result:** Browser downloads valid PDF document (`%PDF-1...`). Document contains event details, venue, ticket numbers, and rendered QR code images.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-TICKET-003: Unauthorized User Blocked from Downloading PDF Ticket
- **Module:** Tickets / Security
- **Role:** Other Participant (`guest@eventdeck.test`)
- **Priority:** Critical
- **Preconditions:** Booking owned by `participant@eventdeck.test`.
- **Steps:**
  1. Log in as `guest@eventdeck.test`.
  2. Attempt direct GET request to `/api/tickets/<other-user-booking-id>/pdf`.
- **Expected Result:** Request returns HTTP 404 Not Found.
- **Status:** ✅ Automated & Passing (`e2e/booking.spec.ts`)

### TC-TICKET-004: Ticket Invalidation on Event Cancellation
- **Module:** Tickets
- **Role:** System
- **Priority:** Critical
- **Preconditions:** Event cancelled by Administrator.
- **Steps:**
  1. Inspect `tickets.status` for all bookings of the cancelled event.
  2. Attempt to download ticket PDF.
- **Expected Result:** All tickets set to `status: invalidated` with reason `Event cancelled`. PDF endpoint returns HTTP 409 Conflict.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-TICKET-005: QR Code Contains Pure Token (No PII)
- **Module:** Tickets / Privacy
- **Role:** QA Inspector
- **Priority:** High
- **Steps:**
  1. Decode QR payload from generated ticket.
- **Expected Result:** Payload contains only prefix and token: `EVD1:<24-byte-base64url>`. No name, email, payment status, or event details are leaked inside the QR payload.
- **Status:** ✅ Automated & Passing (`tests/unit/domain.test.ts`)

---

## 10. Module SCAN: Door Check-in & Scanner Validation

### TC-SCAN-001: Successful Ticket Check-in via Camera QR Decoding
- **Module:** Scanner
- **Role:** Organizer / Moderator
- **Priority:** Critical
- **Preconditions:** Active check-in window. Valid ticket QR presented to scanner.
- **Steps:**
  1. Open scanner at `/organizer/events/[id]/scan` or `/moderate/[id]`.
  2. Scan ticket QR code.
- **Expected Result:** Scanner beeps/flashes green. Displays attendee name, tier name, and ticket number. Server records check-in row.
- **Status:** ✅ Automated & Passing (`e2e/camera.spec.ts` using Chromium fake webcam)

### TC-SCAN-002: Duplicate Check-in Prevention
- **Module:** Scanner
- **Role:** Moderator
- **Priority:** Critical
- **Steps:**
  1. Scan a valid ticket once (successful check-in).
  2. Scan the identical ticket a second time.
- **Expected Result:** Scanner displays warning: *"Already checked in ... by <name>"*. No second check-in row is created (`check_ins.ticket_id UNIQUE`).
- **Status:** ✅ Automated & Passing (`e2e/moderators.spec.ts`)

### TC-SCAN-003: Simultaneous Scans by Two Moderators (Race Condition)
- **Module:** Scanner / Concurrency
- **Role:** Two Active Moderators
- **Priority:** Critical
- **Steps:**
  1. Two moderators scan the identical ticket at the exact same millisecond across two browser sessions.
- **Expected Result:** Exactly one scan returns `status: checked_in`; the other returns `status: already_used`. Database records exactly 1 check-in row.
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`, `e2e/moderators.spec.ts`)

### TC-SCAN-004: Ticket from a Different Event Rejected
- **Module:** Scanner
- **Role:** Moderator
- **Steps:**
  1. Present a valid ticket belonging to Event A to the scanner for Event B.
- **Expected Result:** Scanner displays error: *"This ticket is for a different event."* Check-in is rejected and logged.
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`)

### TC-SCAN-005: Scan Outside Check-in Window
- **Module:** Scanner
- **Role:** Moderator
- **Preconditions:** Event check-in window has not opened yet or has closed.
- **Steps:**
  1. Scan valid ticket.
- **Expected Result:** Scanner displays: *"Outside check-in window"* (*"Check-in hasn't opened yet"* / *"Check-in has closed"*).
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-SCAN-006: Manual Ticket Number Entry Fallback
- **Module:** Scanner
- **Role:** Moderator
- **Steps:**
  1. Switch to *Manual entry* tab in scanner.
  2. Type ticket number `EVT-XXXX-XXXX`. Click *Check in*.
- **Expected Result:** Ticket validated and checked in identically to QR scan.
- **Status:** ✅ Automated & Passing (`e2e/quality.spec.ts`)

### TC-SCAN-007: Physical Phone Camera over HTTPS
- **Module:** Scanner / Mobile
- **Role:** Moderator
- **Priority:** High
- **Steps:**
  1. Access `/moderate/[id]` from a physical mobile device over HTTPS.
  2. Allow camera permission and scan printed QR.
- **Expected Result:** Rear camera activates and scans smoothly without permission crashes.
- **Status:** ⛔ Blocked (Requires deployed HTTPS environment and physical phone)

---

## 11. Module MOD: Moderator Delegation & Scoped Access

### TC-MOD-001: Organizer Assigns Check-in Moderator by Email
- **Module:** Moderator Delegation
- **Role:** Organizer
- **Priority:** Critical
- **Steps:**
  1. Organizer opens `/organizer/events/[id]/team`.
  2. Enters participant email `participant@eventdeck.test`. Click *Add moderator*.
- **Expected Result:** Moderator is added. Participant receives in-app notification: *"You're a check-in moderator"*. Nav displays *Check-in* item.
- **Status:** ✅ Automated & Passing (`e2e/moderators.spec.ts`)

### TC-MOD-002: Maximum 10 Moderators Per Event Cap
- **Module:** Moderator Delegation
- **Role:** Organizer
- **Priority:** High
- **Steps:**
  1. Add 10 active moderators to an event.
  2. Attempt to add an 11th moderator.
- **Expected Result:** 11th addition is rejected: *"An event can have up to 10 active moderators."*
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`)

### TC-MOD-003: Moderator Dashboard Shows Assigned Events Only
- **Module:** Moderator Delegation
- **Role:** Moderator
- **Steps:**
  1. Log in as moderator. Navigate to `/moderate`.
- **Expected Result:** Displays only events where user has an active assignment. Unassigned events are absent.
- **Status:** ✅ Automated & Passing (`e2e/moderators.spec.ts`)

### TC-MOD-004: Immediate Scan Revocation
- **Module:** Moderator Delegation
- **Role:** Organizer & Moderator
- **Priority:** Critical
- **Steps:**
  1. Moderator is scanning tickets.
  2. Organizer clicks *Revoke* on `/organizer/events/[id]/team`.
  3. Moderator attempts next scan immediately.
- **Expected Result:** Revocation takes effect instantly. Next scan returns HTTP 403: *"You're not a check-in moderator for this event."*
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`, `e2e/moderators.spec.ts`)

### TC-MOD-005: Moderator Blocked from Organizer Management Pages
- **Module:** Moderator Delegation
- **Role:** Moderator
- **Priority:** Critical
- **Steps:**
  1. As moderator, attempt to open `/organizer/events/[id]/edit` or `/organizer/events/[id]/bookings`.
- **Expected Result:** Redirected to `/forbidden`.
- **Status:** ✅ Automated & Passing (`e2e/moderators.spec.ts`)

### TC-MOD-006: Check-in Attribution in Attendance Log & CSV
- **Module:** Moderator Delegation
- **Role:** Organizer
- **Priority:** Medium
- **Steps:**
  1. View Attendance table on `/organizer/events/[id]/attendance`.
- **Expected Result:** Scanned tickets display *"Scanned by <Moderator Name>"* with exact timestamp. CSV export includes scanner attribution column.
- **Status:** ✅ Automated & Passing (`e2e/moderators.spec.ts`)

---

## 12. Module ADMIN: Admin Operations, Refunds & Payouts

### TC-ADMIN-001: Review & Approve Organizer Application
- **Module:** Admin Operations
- **Role:** Administrator
- **Priority:** Critical
- **Preconditions:** Participant submitted organizer application.
- **Steps:**
  1. Go to `/admin/users?tab=applications`.
  2. Click *Approve* on pending application.
- **Expected Result:** Application status updates to `approved`. User's `profiles.role` updates to `organizer`. Applicant receives notification.
- **Status:** ✅ Automated & Passing (`e2e/admin.spec.ts`)

### TC-ADMIN-002: User Account Deactivation and Ban
- **Module:** Admin Operations
- **Role:** Administrator
- **Priority:** High
- **Steps:**
  1. Go to `/admin/users`. Locate user. Click *Deactivate*.
- **Expected Result:** `profiles.is_active` set to `false`. Supabase Auth bans user. Active sessions terminated; new sign-ins blocked.
- **Status:** ✅ Automated & Passing (`tests/integration/auth-authorization.test.ts`)

### TC-ADMIN-003: Event Cancellation Request Approval & Automatic Refund Queueing
- **Module:** Admin Operations
- **Role:** Administrator
- **Priority:** Critical
- **Steps:**
  1. Go to `/admin/cancellations`. Review pending organizer request. Click *Approve*.
- **Expected Result:** Event marked `cancelled`. Bookings update to `event_cancelled`. Refunds queued in `refunds` table with `status: pending`.
- **Status:** ✅ Automated & Passing (`e2e/admin.spec.ts`)

### TC-ADMIN-004: Process Single Refund (Razorpay Test API)
- **Module:** Admin Operations / Refunds
- **Role:** Administrator
- **Priority:** High
- **Steps:**
  1. Go to `/admin/refunds`. Locate pending refund. Click *Process refund*.
- **Expected Result:** Server dispatches refund call to Razorpay API (or simulator). Refund status updates to `processed`.
- **Status:** ✅ Automated & Passing (`e2e/admin.spec.ts`)

### TC-ADMIN-005: Bulk Refund Processing
- **Module:** Admin Operations / Refunds
- **Role:** Administrator
- **Priority:** High
- **Steps:**
  1. Click *Process all pending refunds*.
- **Expected Result:** Server loops through pending refunds with concurrency guard. All pending refunds processed.
- **Status:** ⏳ Not Run (Tested in integration test)

### TC-ADMIN-006: Organizer Payout Request & Settlement
- **Module:** Admin Operations / Payouts
- **Role:** Organizer & Administrator
- **Priority:** High
- **Steps:**
  1. Organizer saves Bank/UPI details on `/organizer/payouts` and submits payout request for ₹5,000.
  2. Admin visits `/admin/payouts`, reviews beneficiary snapshot, enters UTR reference `UTR987654321`, and clicks *Mark Completed & Disbursed*.
- **Expected Result:** Payout status updates to `completed`. UTR and timestamp recorded. Organizer receives confirmation.
- **Status:** ✅ Automated & Passing (`tests/unit/payouts.test.ts`)

### TC-ADMIN-007: CSV Export Security (Formula Injection Guard)
- **Module:** Admin Operations / Reports
- **Role:** Administrator
- **Priority:** Critical
- **Steps:**
  1. User with name `=1+2';calc|'` books ticket.
  2. Admin exports bookings CSV from `/admin/reports`.
- **Expected Result:** Sensitive characters (`=`, `+`, `-`, `@`) are prepended with a single quote (`'`) to prevent spreadsheet formula injection.
- **Status:** ✅ Automated & Passing (`tests/unit/domain.test.ts`)

### TC-ADMIN-008: Audit Log Immutable Recording
- **Module:** Admin Operations / Audit
- **Role:** Administrator
- **Priority:** High
- **Steps:**
  1. Perform various actions (role change, cancellation, refund).
  2. Navigate to `/admin/audit`.
- **Expected Result:** Audit log displays chronological record with actor, entity ID, action type, and JSON details.
- **Status:** ⏳ Not Run (Verified via unit/integration queries)

---

## 13. Module SEC: Data Tampering & Security Negative Tests

### TC-SEC-001: Client Price Tampering Rejected
- **Module:** Security
- **Role:** Attacker
- **Priority:** Critical
- **Steps:**
  1. Tamper client request to pay ₹1 for a ₹499 ticket tier.
- **Expected Result:** Server creates Razorpay order strictly from `bookings.amount_paise` read from database. Tampered client price is ignored.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)

### TC-SEC-002: ID Tampering on Booking Order Creation
- **Module:** Security
- **Role:** Attacker
- **Priority:** Critical
- **Steps:**
  1. User A attempts to call `/api/payments/order` with `bookingId` belonging to User B.
- **Expected Result:** Server returns HTTP 404 / DomainError *"Booking not found"*. No order is created.
- **Status:** ✅ Automated & Passing (`tests/integration/api-security.test.ts`)

### TC-SEC-003: Forged QR Code Token Rejected by Scanner
- **Module:** Security
- **Role:** Attacker
- **Priority:** Critical
- **Steps:**
  1. Present a fabricated QR payload (random 32-character string or JSON object) to scanner.
- **Expected Result:** Scanner displays: *"That code isn't a ticket from this system"* or *"Ticket not found"*. Nothing trusted from QR.
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`)

### TC-SEC-004: Ticket Invalidation on Event Cancellation Verified at Scan
- **Module:** Security
- **Role:** Attacker / Attendee
- **Priority:** Critical
- **Steps:**
  1. Present a previously valid ticket for an event that has since been cancelled.
- **Expected Result:** Server rejects scan: *"This event has been cancelled — all tickets are void."*
- **Status:** ✅ Automated & Passing (`tests/integration/moderators.test.ts`)

### TC-SEC-005: Client Profile Self-Promotion to SRM Staff Blocked
- **Module:** Security
- **Role:** External User
- **Priority:** High
- **Steps:**
  1. User with `@gmail.com` edits profile via `/my/profile` attempting to select `SRM` institution and `STAFF` affiliation.
- **Expected Result:** Server rejects update with error: *"SRM students and staff need an official SRM email (@srmist.edu.in)"*.
- **Status:** ✅ Automated & Passing (`tests/integration/eligibility-bypass.test.ts`)

### TC-SEC-006: Reused Razorpay Payment Reference Rejected
- **Module:** Security
- **Role:** Attacker
- **Priority:** Critical
- **Steps:**
  1. Submit a payment verification with a `payment_id` that was already used to confirm another booking.
- **Expected Result:** Server detects duplicate payment; flags order for administrative review; does not issue a second set of tickets.
- **Status:** ✅ Automated & Passing (`tests/integration/booking-engine.test.ts`)
