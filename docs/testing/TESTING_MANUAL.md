# EventDeck — Complete Functional Testing Manual, Role-Based QA & Razorpay Payment Testing

> **Document Type:** Comprehensive Quality Assurance & Functional Testing Manual  
> **Target Audience:** Software Test Engineers, QA Architects, Academic Evaluators, University Administrators, and Project Reviewers  
> **Application Version:** EventDeck 0.1.0  
> **Verified Technology Stack:** Next.js 16 (App Router, Turbopack, React 19), TypeScript, Supabase PostgreSQL, Supabase Auth & Storage, Drizzle ORM, Razorpay Test Mode Checkout, `pdf-lib`, `qrcode`, `html5-qrcode`.  
> **Document Last Updated:** October 2026

---

## 1. Document Overview & Purpose

This manual is the authoritative, step-by-step testing guide for **EventDeck**, an enterprise-grade university event management and ticketing platform. It provides comprehensive procedures to test the application from authentication through event publishing, multi-tier ticket reservations, transactional inventory holding, Razorpay Test Mode checkout, ticket PDF/QR generation, door check-in scanning, and administrative settlements.

Every test procedure in this document reflects the **actual code implementation** within the EventDeck repository. Features that are fully functional are detailed with exact steps and expected outcomes; architectural specifics (such as the event-scoped check-in moderator design) are documented truthfully; and known environment limitations are explicitly identified.

---

## 2. System Architecture & Verified Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client Application                            │
│  Next.js 16 (React 19) · Tailwind CSS v4 · Base UI / Lucide React     │
│  Razorpay Checkout.js (Modal) · HTML5 QR Scanner · PDF Download Stream │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / SSR Session Cookies
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Server Layer                            │
│  src/proxy.ts (Session Gate) · Server Actions · Route Handlers         │
│  src/lib/server/* (Domain Logic & Postgres Transactions via Drizzle)   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐   ┌─────────────────────────────┐
│       Hosted Supabase Cloud          │   │    Razorpay Payment Gateway │
│ • PostgreSQL 15+ (RLS on all tables) │   │ • Test Mode APIs (v1)       │
│ • Supabase Auth (SSR sessions)       │   │ • HMAC Signature Verify     │
│ • Supabase Storage (posters/tickets) │   │ • Webhook Event Processing  │
│ • Supabase Realtime (notifications)  │   │ • Automated Refund Queue    │
└──────────────────────────────────────┘   └─────────────────────────────┘
```

### Core Security & Data Integrity Principles:
1. **Server-Enforced Authorization:** Every write operation is handled through server actions or route handlers in `src/lib/server/*`. The server validates input schemas with Zod, authenticates the session, verifies role and ownership permissions, and executes within atomic PostgreSQL transactions.
2. **PostgreSQL Row Level Security (RLS):** All database tables have RLS enabled (`drizzle/0001_security_rls_realtime.sql`). Public anonymous and authenticated client connections have zero direct write permissions; PostgREST queries with user JWTs return only authorized rows.
3. **Atomic Inventory Reservation:** Seat availability is guaranteed using conditional database updates (`UPDATE ticket_tiers SET allocated = allocated + n WHERE allocated + n <= capacity`) and table constraints, preventing overselling under heavy concurrency.
4. **Cryptographic Signatures & Dedicated Test Mode:** Payment verification uses HMAC SHA-256 for both client checkout returns and server webhooks. Live payment keys (`rzp_live_…`) are refused by the runtime code contract (`src/lib/razorpay.ts`).

---

## 3. Scope of Testing & Limitations

### In-Scope Modules:
- **Authentication & Identity:** 4-step signup wizard, SRM domain gating, password recovery, session survival, account deactivation.
- **Role-Based Authorization:** Administrator, Event Organizer, Event-Scoped Moderator, and Participant boundaries.
- **Event Management:** Multi-tier pricing, draft/publish lifecycle, venue scheduling, poster magic-byte validation, multi-campus and external institution rules.
- **Booking & Inventory:** Multi-ticket reservations, attendee names, 10-minute transactional seat holds, complimentary pass approval workflows.
- **Razorpay Payments (Test Mode):** Domestic Indian cards (Visa, Mastercard, RuPay, Amex, Diners), International cards, Indian Netbanking simulations (mock bank pages), UPI simulation, signature validation, decline handling, and late payment reconciliation.
- **Tickets & Check-in:** 192-bit cryptographic QR tokens, access-controlled PDF ticket generation, camera QR scanner, duplicate prevention across devices, check-in windows.
- **Operations & Settlement:** Event cancellation approval, automatic refund queueing, organizer bank/UPI payouts, UTR recording, CSV exports.

### Testing Limitations & Exclusions:
1. **Live Money Transactions:** Strictly excluded. EventDeck only supports Razorpay Test Mode (`rzp_test_…`). Real debit/credit cards or real bank accounts must never be used.
2. **Physical Device Scanning:** While camera decoding is verified via automated fake webcam streams in Chromium (`e2e/camera.spec.ts`), testing physical smartphone cameras requires an active HTTPS URL (camera access is restricted in mobile browsers over insecure HTTP).
3. **Third-Party Email Delivery:** Supabase free-tier email service has strict rate limits. For rapid testing and automated suites, email confirmation can be disabled in the Supabase test project.

---

## 4. Test Environment Setup & Prerequisites

### 4.1. Hardware & Software Requirements
- **Operating System:** macOS, Windows 10/11, or Linux.
- **Node.js:** Version 20.9+ (Node.js 24 LTS recommended).
- **Package Manager:** npm (bundled with Node.js).
- **Browser:** Google Chrome / Chromium, Mozilla Firefox, or Apple Safari (latest versions).
- **Git:** Installed and configured.

### 4.2. Environment Configuration Files

EventDeck uses explicit environment files to separate production, development, and testing:

| Environment File | Purpose | Database Target | Safety Constraints |
| :--- | :--- | :--- | :--- |
| `.env.local` | Local development & manual testing | Hosted Supabase project | Do not commit private keys |
| `.env.test` | Vitest integration & Playwright E2E | Dedicated Supabase **test** project | Refuses primary project by default |
| `.env.cloud` | Staging / Cloud migration runs | Staging Supabase project | Production credentials |

#### Minimal Required Variables for Testing (`.env.local`):
```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:password@aws-0-region.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Test / Demo Account Password
SEED_DEMO_PASSWORD=YourSecureTestPassword123!
ALLOW_MOCK_PAYMENTS=false
```

### 4.3. Step-by-Step Initial Setup
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Eventdeck88/EventDeck.git
   cd EventDeck
   npm install
   ```
2. Apply database migrations:
   ```bash
   npm run db:migrate
   ```
3. Populate demo accounts and events:
   ```bash
   npm run db:seed
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000` in your browser.

---

## 5. Role-Permission Matrix & Access Boundaries

| Capability / Route | Administrator | Event Organizer | Check-in Moderator | Participant | Anonymous |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Landing & Event Discovery** (`/`, `/events`) |  Full |  Full |  Full |  Full |  Full |
| **View Event Details** (`/events/[slug]`) |  Full |  Full |  Full |  Full |  Full |
| **Book Tickets** (Free & Paid) |  Full |  Full |  Full |  Full | ⛔ Redirect to `/login` |
| **Participant Portal** (`/my/bookings`, `/my/profile`) |  Full |  Full |  Full |  Full | ⛔ Redirect to `/login` |
| **Moderator Portal** (`/moderate`) |  All Events |  Own Events |  Assigned Events | ⛔ Empty State | ⛔ Redirect to `/login` |
| **Scan Tickets** (`/moderate/[id]`, `/organizer/events/[id]/scan`) |  All Events |  Own Events |  Assigned Events | ⛔ 404 / 403 Forbidden | ⛔ Redirect to `/login` |
| **Organizer Portal** (`/organizer`) |  Full |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Create & Edit Events** (`/organizer/events/new`) |  Full |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Manage Event Team** (`/organizer/events/[id]/team`) |  Full |  Own Events | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Request Event Cancellation** |  Direct Cancel |  Request Review | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Admin Console** (`/admin/*`) |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Review Organizer Applications** (`/admin/users`) |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Approve Cancellations & Process Refunds** |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Disburse Organizer Payouts** (`/admin/payouts`) |  Full | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |
| **Export Platform CSV Reports** (`/admin/reports`) |  Full | ⛔ Event Only | ⛔ `/forbidden` | ⛔ `/forbidden` | ⛔ Redirect to `/login` |

---

## 6. End-to-End Workflow Testing Procedures

---

### Workflow A: Participant Experience (Discovery, Reservation, Razorpay Payment & Ticket Retrieval)

#### Objective:
Verify that a participant can discover an event, select multi-tier tickets, complete an atomic seat reservation, pay via Razorpay Test Mode, and retrieve verified tickets with valid QR codes and downloadable PDF.

#### Preconditions:
1. Application is running at `http://localhost:3000`.
2. Event `Inter-College Football Cup — Finals` or `Raag & Rhythm` is published and has available capacity.
3. Razorpay Test Mode keys are configured (or `ALLOW_MOCK_PAYMENTS=true`).

#### Step-by-Step Execution:
1. **Sign In or Register:**
   - Navigate to `/login`.
   - Enter credentials: `participant@eventdeck.test` / `SEED_DEMO_PASSWORD`.
   - Click **Sign in**. Verify redirection to `/my/bookings`.
2. **Browse Events:**
   - Click **Events** in the navigation header (`/events`).
   - Use search or filter: select Category **Cultural** or search `Fusion`.
   - Click on the event card for **Raag & Rhythm — An Evening of Indian Classical Fusion**.
3. **Select Ticket Tiers:**
   - On the event detail page (`/events/[slug]`), review the ticket selector:
     - Click **+** on *Gold Tier* (₹349.00) → Quantity = 1.
     - Click **+** on *Silver Tier* (₹149.00) → Quantity = 1.
   - Enter attendee names for each seat: `Riya Sharma` and `Ananya Sharma`.
   - Verify that the action button updates to: **Reserve & pay ₹498.00**.
4. **Initiate Booking Reservation:**
   - Click **Reserve & pay ₹498.00**.
   - Verify redirection to `/my/bookings/<booking-id>`.
   - **Verification Points:**
     - Status badge shows: **Awaiting payment**.
     - Amber banner displays: *"Seats held for you. Pay before the timer ends to keep them."*
     - Live countdown timer displays (starts at `09:59` and decrements each second).
5. **Launch Razorpay Checkout:**
   - Click the primary button: **Pay ₹498.00**.
   - **Expected Result:** Razorpay Checkout modal opens with EventDeck branding, displaying amount `₹498.00` and prefilled user name/email.
6. **Complete Payment (Test Card Flow):**
   - In the modal, select **Card**.
   - Enter official test card details:
     - Card Number: `4100 2800 0000 1007` (Visa Domestic Test Card)
     - Expiry: `12/28` (or any future date)
     - CVV: `123`
   - Click **Pay Now**.
   - On the simulated bank authorization screen, enter OTP `123456` and click **Submit** (or click **Success**).
7. **Verify Server Signature & Booking Confirmation:**
   - The browser returns to EventDeck; button shows: *"Verifying payment…"*.
   - `/api/payments/verify` validates the HMAC SHA-256 signature against `RAZORPAY_KEY_SECRET`.
   - Page refreshes automatically.
   - **Verification Points:**
     - Status updates to **Approved** (green badge).
     - Payment status displays **Paid**.
     - Exactly 2 tickets are rendered on screen, each with attendee name, ticket number (`R&R-XXXX-XXXX`), and a scannable QR code.
8. **Download PDF Ticket:**
   - Click **Download tickets (PDF)**.
   - Verify that browser downloads `<reference>-tickets.pdf`.
   - Open PDF: verify event banner, venue, dates, attendee names, and rendered 2D barcode images.

---

### Workflow B: Event Organizer Experience (Creation, Tiers, Team Delegation & Door Attendance)

#### Objective:
Verify that an event organizer can create a multi-tier event, configure audience eligibility rules, delegate a check-in moderator by email, monitor live attendance, and view attendee attribution.

#### Preconditions:
1. Logged in as `organizer@eventdeck.test`.

#### Step-by-Step Execution:
1. **Access Organizer Console:**
   - Click **Organizer** in the navigation header (`/organizer`).
   - Review metrics: Total events, active tickets, live check-ins, and pending verification requests.
2. **Create New Event:**
   - Navigate to `/organizer/events/new`.
   - Fill in Event Basics:
     - Title: `SRM National Tech Fest 2026`
     - Category: `Technical`
     - Venue: `Tech Park, 3rd Floor, SRM KTR`
     - Summary: `Flagship technical symposium and project exhibition.`
   - Configure Schedules:
     - Start Date/Time: 10 days in future, 09:00 IST.
     - End Date/Time: 10 days in future, 17:00 IST.
     - Registration Deadline: 2 hours prior to start.
     - Check-in Window: Opens 1 hour before start, closes at event end.
   - Configure Ticket Tiers:
     - Tier 1: `Student Pass`, Price: `₹0`, Capacity: `150`.
     - Tier 2: `Hackathon Entry`, Price: `₹199`, Capacity: `50`.
   - Configure Audience Eligibility:
     - Permitted Institutions: `SRM University` + `Other College / University`.
     - Permitted Campuses: `KTR` + `Ramapuram`.
   - Click **Save draft** (or **Publish event**).
3. **Delegate Check-in Moderator:**
   - Open event dashboard: `/organizer/events/<event-id>`.
   - Click the **Team** tab (`/organizer/events/<event-id>/team`).
   - In the **Add Check-in Moderator** form:
     - Enter email: `participant@eventdeck.test`.
     - Click **Add moderator**.
   - Verify: `participant@eventdeck.test` appears in the Active Moderators list with status `Active` and scan count `0`.
4. **Inspect Live Attendance:**
   - Click the **Attendance** tab (`/organizer/events/<event-id>/attendance`).
   - Review the table of attendees. After scans occur, verify that each row displays the checked-in timestamp and the name of the moderator who performed the scan.
   - Click **Export CSV** to download the audited attendance list.

---

### Workflow C: Moderator Check-in Experience (Event-Scoped Door Operations)

#### Objective:
Verify that an account delegated as an event moderator can access the check-in duty portal, scan valid tickets, detect duplicate scans, and be blocked from unauthorized events.

#### Preconditions:
1. Logged in as `participant@eventdeck.test` (assigned as moderator for `Orientation Mixer for New Students` in Workflow B).
2. A valid ticket QR code for `Orientation Mixer` is available for scanning.

#### Step-by-Step Execution:
1. **Access Moderator Portal:**
   - In navbar, notice the new **Check-in** link (only visible when an account moderates active events).
   - Click **Check-in** (`/moderate`).
   - Verify: `Orientation Mixer for New Students` is listed with badge **Check-in open**. Unassigned events are absent.
2. **Open Scanner Interface:**
   - Click **Open scanner** on the event card (`/moderate/<event-id>`).
   - Header displays: `Moderator scanner · Orientation Mixer for New Students`.
   - Attendance counter displays current check-in count (e.g., `12 checked in`).
3. **Scan Valid Ticket (Camera or Manual):**
   - Click **Scan ticket** to open the live camera feed (or click the **Manual entry** tab).
   - Enter ticket number: `OMN-XXXX-XXXX` (or scan QR).
   - Click **Check in**.
   - **Expected Result:**
     - Scanner flashes green.
     - Audio feedback / success sound plays.
     - Result card displays: *"Welcome in!"*, Attendee Name, Ticket Tier, and Ticket Number.
     - Counter increments by 1.
4. **Test Duplicate Scan Rejection:**
   - Immediately re-enter or re-scan the identical ticket.
   - **Expected Result:**
     - Scanner flashes amber/red.
     - Error displays: *"Already checked in at <timestamp> by <Moderator Name>"*.
     - Attendance counter does not increment.
5. **Test Cross-Event Scan Rejection:**
   - Enter a ticket number belonging to `SRM Hackathon 2026`.
   - **Expected Result:**
     - Error displays: *"This ticket is for a different event."*
     - Check-in rejected; logged in audit table.
6. **Verify Immediate Access Revocation:**
   - In another browser tab, have the Organizer revoke this moderator's access.
   - Attempt another scan in the moderator scanner.
   - **Expected Result:** Scan fails with HTTP 403: *"You're not a check-in moderator for this event."*

---

### Workflow D: Administrator Operations (Cancellations, Refunds, Payouts & Audit)

#### Objective:
Verify that an administrator can review organizer applications, process event cancellations with automatic refund queueing, execute Razorpay test refunds, and settle organizer payouts.

#### Preconditions:
1. Logged in as `admin@eventdeck.test` (or root admin `eventdeck88@gmail.com`).

#### Step-by-Step Execution:
1. **Review Organizer Applications:**
   - Navigate to `/admin/users?tab=applications`.
   - Review pending application from `applicant@eventdeck.test` (Organization: *Directorate of Student Affairs*).
   - Click **Approve**.
   - Verify: Applicant's role changes to `organizer`; applicant receives in-app notification.
2. **Review Event Cancellation Request:**
   - Navigate to `/admin/cancellations`.
   - Review pending cancellation request from organizer for `Careers in Product: Alumni Fireside`.
   - Reason: *"Two of the three alumni speakers can no longer travel on this date."*
   - Click **Approve cancellation**.
   - **Expected Result:**
     - Event status updates to `cancelled`.
     - Tickets invalidated.
     - All paid bookings for this event transition to `event_cancelled` with `refund_status: pending`.
     - Banner confirms: *"Event cancelled. X booking(s) affected, Y refund(s) queued."*
3. **Process Razorpay Test Refunds:**
   - Navigate to `/admin/refunds`.
   - The pending refunds are displayed with booking reference, participant name, amount (₹), and Razorpay Payment ID.
   - Click **Process refund** for a single item (or **Process all pending refunds**).
   - **Expected Result:**
     - Server issues `POST /v1/payments/{paymentId}/refund` to Razorpay Test API.
     - Refund status updates to **Processed** (or awaits webhook confirmation).
     - Participant sees **Refund processed** on `/my/bookings/[id]`.
4. **Process Organizer Payout:**
   - Navigate to `/admin/payouts`.
   - Review requested payout from organizer for net ticket revenue.
   - Inspect bank account number / IFSC or UPI ID snapshot.
   - Click **Process Payout**.
   - Enter simulated bank UTR: `UTR202610159981`.
   - Click **Confirm & Disburse**.
   - Payout status updates to `completed`.
5. **Inspect System Audit Log:**
   - Navigate to `/admin/audit`.
   - Verify chronological log of all actions (`organizer.approved`, `cancellation.approved`, `refund.processed`, `payout.completed`) with actor ID, entity ID, and details.

---

## 7. Razorpay Payment Testing Reference Guide

### 7.1. Official Test Cards Reference (Indian & Domestic)

| Payment Scenario | Network | Card Number | Expiry | CVV | Mock Bank Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Standard Domestic Payment** | Visa | `4100 2800 0000 1007` | Future (e.g. `12/28`) | `123` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; tickets issued |
| **Alternative Domestic Payment**| Visa | `4718 6091 0820 4366` | Future (e.g. `11/29`) | `456` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; tickets issued |
| **Business Domestic Payment** | Mastercard | `5555 5100 0008 1006` | Future (e.g. `10/28`) | `789` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; tickets issued |
| **Domestic RuPay Payment** | RuPay | `6527 6589 0000 1005` | Future (e.g. `07/28`) | `321` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; tickets issued |
| **American Express (Amex)** | Amex | `3402 560004 01007` | Future (e.g. `05/29`) | `1234` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; 4-digit CVV accepted |
| **Diners Club Payment** | Diners | `3608 280009 1007` | Future (e.g. `09/28`) | `555` | Enter 4–10 digits OTP or click **Success** | Payment succeeds; tickets issued |
| **Insufficient Account Balance**| Visa | `4100 2800 0008 0001` | Future (e.g. `12/28`) | `123` | Click **Failure** on mock screen | Payment declined (`insufficient_fund`); retry permitted |
| **Card Authentication Failure** | Any Card | (Any valid card above) | Future (e.g. `12/28`) | `123` | Enter `< 4` digits OTP (e.g. `12`) | Payment fails (`authentication_failed`); seats held |

### 7.2. Indian Netbanking Simulation Procedure
1. On `/my/bookings/[id]`, click **Pay ₹...**.
2. In Razorpay modal, select **Netbanking**.
3. Choose any Indian bank: State Bank of India (SBI), HDFC Bank, ICICI Bank, Axis Bank, or Kotak Mahindra Bank.
4. Click **Pay**. Browser opens the official Razorpay mock bank screen (`api.razorpay.com/v1/payments/.../mock`).
5. **To Test Success:** Click **Success**. Browser redirects back, validates signature, and confirms tickets.
6. **To Test Failure:** Click **Failure**. Browser redirects back, displays failure notification, and preserves seat hold.
7. **Important:** No bank credentials exist or are required in Test Mode.

### 7.3. UPI Simulation Testing
- **VPA `success@razorpay`**: Simulates instant approved UPI payment.
- **VPA `failure@razorpay`**: Simulates rejected UPI payment.

---

## 8. Database Inspection & Verification Queries

During or after manual test runs, execute these SQL queries against your test database to verify state transitions:

```sql
-- 1. Check booking lifecycle and payment status
SELECT reference, kind, status, payment_status, refund_status, quantity, amount_paise, created_at 
FROM bookings ORDER BY created_at DESC LIMIT 5;

-- 2. Verify issued tickets and QR tokens
SELECT ticket_number, qr_token, attendee_name, status, issued_at 
FROM tickets WHERE booking_id = 'YOUR_BOOKING_ID';

-- 3. Verify door check-in logs and moderator attribution
SELECT c.scanned_at, c.method, t.ticket_number, t.attendee_name, p.full_name AS scanned_by_name
FROM check_ins c
JOIN tickets t ON t.id = c.ticket_id
JOIN profiles p ON p.id = c.scanned_by
ORDER BY c.scanned_at DESC LIMIT 5;

-- 4. Verify payment attempts and HMAC verification
SELECT order_id, payment_id, provider, amount_paise, status, signature_verified, confirmed_via, created_at 
FROM payments ORDER BY created_at DESC LIMIT 5;

-- 5. Verify refund queue
SELECT r.amount_paise, r.status, r.provider_refund_id, r.reason, b.reference 
FROM refunds r
JOIN bookings b ON b.id = r.booking_id
ORDER BY r.created_at DESC LIMIT 5;
```

---

## 9. Troubleshooting & Failure Recovery

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **"Seats held for you" timer expires** | 10-minute hold window elapsed before checkout completion | Click *Reserve again* on the event page. If seats remain, a new hold will be issued. |
| **Razorpay modal does not open** | `RAZORPAY_KEY_ID` is missing or invalid | Verify `.env.local` has `RAZORPAY_KEY_ID=rzp_test_...`. If testing locally without keys, set `ALLOW_MOCK_PAYMENTS=true`. |
| **"Payment verification failed" (403)** | `RAZORPAY_KEY_SECRET` in `.env.local` does not match the Key ID from Razorpay | Generate a new Test Key pair in Razorpay Dashboard → Settings → API Keys and update `.env.local`. |
| **Camera scanner displays permission error** | Browser blocked camera access or running over insecure HTTP | Allow camera access in browser address bar permissions. For phones, connect over HTTPS or localhost. |
| **"An event can have up to 10 active moderators"** | Organizer attempted to add an 11th moderator | Revoke an inactive or former moderator on `/organizer/events/[id]/team` before adding a new one. |
| **SRM signup rejects email** | User selected SRM Student/Staff but entered non-SRM email | Use an official `@srmist.edu.in` address or select *Other College / University* origin. |
| **Root admin cannot be demoted/deactivated** | Permanent security protection for `eventdeck88@gmail.com` | Expected behavior by design. Root administrator account cannot be modified via UI or API. |

---

## 10. Final Pre-Demonstration QA Checklist

Before conducting a live university evaluation, project review, or demonstration:

- [ ] Run `npm run verify` (`eslint`, `tsc --noEmit`, `vitest run tests/unit`). Verify **0 errors**.
- [ ] Run `npm run db:migrate` to ensure all 6 migrations are applied.
- [ ] Run `npm run db:seed` with a known `SEED_DEMO_PASSWORD`.
- [ ] Test Administrator login: `admin@eventdeck.test`.
- [ ] Test Organizer login: `organizer@eventdeck.test`.
- [ ] Test Participant login: `participant@eventdeck.test`.
- [ ] Perform 1 complete paid booking journey with Razorpay Test Card `4100 2800 0000 1007`.
- [ ] Download and verify the generated PDF Ticket.
- [ ] Test door check-in scan of the ticket at `/moderate/<event-id>`.
- [ ] Attempt duplicate scan and verify rejection banner.
- [ ] Verify that all unexecuted manual test cases in `docs/testing/TEST_CASES.md` are documented.
