# EventDeck — Role-Based Test Account Inventory & Provisioning Guide

> **Document Purpose:** Complete inventory of verified test accounts, authorization levels, role assignment procedures, and safe provisioning methods for functional and acceptance testing of EventDeck.  
> **Security Notice:** All accounts documented here are for **Development, Staging, and Test environments only**. Real customer credentials, live production passwords, and private cryptographic keys must never be committed to source control.

---

## 1. Architectural Role Model Overview

In EventDeck, identity and authorization are governed by a hybrid architecture combining **Supabase Auth** for authentication, **PostgreSQL profiles** for platform-wide roles, and **event-specific assignments** for door moderation:

1. **Global Platform Roles (`profiles.role`)**:
   - `admin`: Full system oversight, user management, cancellation review, refund processing, audit log inspection, and payout processing.
   - `organizer`: Event creation, editing, scheduling, tier pricing, inventory allocation, attendee management, pass approval, moderator delegation, and payout requests.
   - `participant`: Event discovery, ticket reservation, Razorpay Test Mode checkout, ticket PDF/QR retrieval, and booking management. (Every new user signs up as `participant` by default via a database trigger).

2. **Event-Scoped Check-in Moderator (`event_moderators`)**:
   - **Crucial Architectural Distinction:** In EventDeck, "Moderator" is **not** a separate global enum in `profiles.role`. Instead, any active account (typically a participant or organizer) can be delegated by an event organizer to act as a check-in scanner for a specific event via the `event_moderators` table.
   - Moderators gain access to the `/moderate` portal and scanner (`/moderate/[eventId]`), but remain restricted from all administrative and organizer management dashboards.

3. **Permanent Root Administrator**:
   - `eventdeck88@gmail.com` is configured in `src/lib/constants.ts` and `src/lib/auth.ts` as the permanent root administrator. It is hardcoded to be unconditionally active and cannot be modified, demoted, deactivated, or deleted.

---

## 2. Test Account Inventory

The following test accounts are pre-configured through the development database seed script (`npm run db:seed`) and the administrative CLI bootstrap (`npm run admin:create`).

| Role / Function | Test Email | Default Password Source | Category / Affiliation | Status / Precondition | Key Accessible Modules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | Staff (`SRM IST KTR Staff`) | Pre-seeded / Confirmed | `/admin`, `/admin/events`, `/admin/users`, `/admin/cancellations`, `/admin/refunds`, `/admin/payouts`, `/admin/exceptions`, `/admin/reports`, `/admin/audit` |
| **Root Administrator** | `eventdeck88@gmail.com` | Configured during initial Supabase Auth setup | Staff (`Root Admin`) | Permanent / Protected | All `/admin` modules + immutable root privileges |
| **Event Organizer (Faculty)** | `organizer@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | Faculty (`SRM IST KTR — Dept. of Computing Technologies`) | Pre-seeded / Confirmed | `/organizer`, `/organizer/events`, `/organizer/events/new`, `/organizer/events/[id]/*`, `/organizer/payouts` |
| **Event Organizer (Student Lead)** | `cultural@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | SRM Student (`SRM IST KTR — Directorate of Student Affairs`) | Pre-seeded / Confirmed | `/organizer`, `/organizer/events`, `/organizer/events/new`, `/organizer/events/[id]/*`, `/organizer/payouts` |
| **Event-Scoped Moderator** | `participant@eventdeck.test` *(or any test account assigned to event)* | `SEED_DEMO_PASSWORD` from `.env.local` | SRM Student (`host_student`) | Assigned via Organizer Team UI | `/moderate`, `/moderate/[eventId]`, `/api/checkin` (only for assigned event) |
| **Participant (SRM Student)** | `participant@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | SRM Student (`SRM IST KTR — Computer Science`) | Pre-seeded / Confirmed | `/events`, `/my/bookings`, `/my/profile`, `/my/notifications` |
| **Participant (External Student)** | `guest@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | External Student (`Loyola College, Chennai`) | Pre-seeded / Confirmed | `/events`, `/my/bookings`, `/my/profile`, `/my/notifications` |
| **Participant (Reservation Queue)** | `aditi@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | SRM Student (`Electronics & Communication`) | Pre-seeded / Confirmed | `/events`, `/my/bookings` (has active hold awaiting payment) |
| **Organizer Applicant** | `applicant@eventdeck.test` | `SEED_DEMO_PASSWORD` from `.env.local` | SRM Student (`Directorate of Student Affairs`) | Pre-seeded / Confirmed | `/my/profile` (submits application for admin review) |

---

## 3. Account Provisioning Procedures

### 3.1. Provisioning the Initial Administrator (CLI Bootstrap)

Administrative privileges cannot be granted through frontend signup or profile editing. To provision an administrator safely on a trusted machine:

```bash
# Provision or promote an administrator with a specific password:
ADMIN_EMAIL="admin@eventdeck.test" ADMIN_NAME="Meera Iyer" ADMIN_PASSWORD="YourSecurePassword123!" npm run admin:create
```

* **Behavior:**
  - If the user does not exist in Supabase Auth, it creates the user with `email_confirm: true` and category `staff`.
  - If `ADMIN_PASSWORD` is omitted, the script generates a 16-character cryptographically secure password and prints it once to stdout.
  - Updates `profiles.role` to `'admin'` and `profiles.is_active` to `true`.
  - Records an entry in `audit_logs` with action `user.admin_provisioned`.

### 3.2. Seeding Development & Test Accounts

To populate all standard test accounts and sample events across categories:

```bash
# Ensure SEED_DEMO_PASSWORD is set in .env.local
npm run db:seed
```

* **Safety Controls in `scripts/seed.ts`:**
  - Requires `SEED_DEMO_PASSWORD` to be explicitly defined.
  - Uses `createClient` with Supabase Service Role key (server-side execution only).
  - Reuses existing accounts if they already exist, only updating their role if changed.
  - Skips event recreation if the demo organizer already has events.
  - Never runs against production without explicit environment credentials.

### 3.3. Provisioning a Check-in Moderator

To test the **Moderator** role and ticket scanning workflow:

1. Log in as an **Event Organizer** (`organizer@eventdeck.test`).
2. Navigate to **Organizer Dashboard** → **My Events** → Select an active event (e.g., `Orientation Mixer for New Students` or `SRM Hackathon 2026`).
3. Click on the **Team** tab (`/organizer/events/[id]/team`).
4. Under **Add Check-in Moderator**, enter the email of an existing test participant (e.g., `participant@eventdeck.test`).
5. Click **Add Moderator**.
6. The account now has access to the `/moderate` portal and can scan tickets for that event.
7. To test revocation, click **Revoke** on the moderator row; immediate revocation is enforced at the database level.

---

## 4. Manual Participant Registration & Email Confirmation Flow

If a tester needs to create a clean, unseeded participant account:

1. Navigate to `http://localhost:3000/signup`.
2. **Step 1: Account Details**
   - Full Name: `Test Participant`
   - Email Address:
     - For SRM Student/Staff: must use `@srmist.edu.in` or `@srmuniv.ac.in` (in development/test environments, `@eventdeck.test` and `@uems.test` are also accepted).
     - For External Student/Guest: any valid email format (e.g., `tester@gmail.com`).
   - Password: Minimum 8 characters.
3. **Step 2: Origin Selection**
   - Choose `SRM University`, `Other College / University`, or `Guest`.
4. **Step 3: Affiliation & Details**
   - If SRM: Select Campus (`KTR`, `RAMAPURAM`, `VADAPALANI`, `OTHER_SRM`) and Affiliation (`Student`, `Faculty`, `Staff`, `Alumni`).
   - If External: Enter Institution Name, City, and Affiliation.
5. **Step 4: Review & Submit**
   - Click **Create account**.
6. **Email Confirmation Handling:**
   - **Local / Test Environment:** If Supabase "Confirm email" is disabled, the user is redirected immediately to `/events`.
   - **If Email Confirmation is Enabled:** Supabase dispatches a confirmation email with a link pointing to `/auth/confirm`. The tester clicks the confirmation link or opens the URL in the browser, which exchanges the auth token and redirects to `/events`.

---

## 5. Account Security Matrix & Restrictions

| Feature / Action | Admin | Organizer | Moderator | Participant |
| :--- | :---: | :---: | :---: | :---: |
| Access `/admin` Console |  Allowed | ⛔ Forbidden (`/forbidden`) | ⛔ Forbidden (`/forbidden`) | ⛔ Forbidden (`/forbidden`) |
| Access `/organizer` Console |  Allowed |  Allowed | ⛔ Forbidden (`/forbidden`) | ⛔ Forbidden (`/forbidden`) |
| Access `/moderate` Scanner |  Allowed (All Events) |  Allowed (Own Events) |  Allowed (Assigned Events Only) | ⛔ Forbidden (No Assignments) |
| Manage Any Event |  Allowed | ⛔ Own Events Only | ⛔ Forbidden | ⛔ Forbidden |
| Approve Organizer Applications |  Allowed | ⛔ Forbidden | ⛔ Forbidden | ⛔ Forbidden |
| Deactivate User Accounts |  Allowed | ⛔ Forbidden | ⛔ Forbidden | ⛔ Forbidden |
| Trigger Bulk / Event Refunds |  Allowed | ⛔ Request Cancellation Only | ⛔ Forbidden | ⛔ Forbidden |
| Process Organizer Payouts |  Allowed | ⛔ Request Payout Only | ⛔ Forbidden | ⛔ Forbidden |
| Create & Publish Events |  Allowed |  Allowed | ⛔ Forbidden | ⛔ Forbidden |
| Assign Event Moderators |  Allowed |  Allowed (Own Events) | ⛔ Forbidden | ⛔ Forbidden |
| Scan Door Tickets |  Allowed (All Events) |  Allowed (Own Events) |  Allowed (Assigned Events) | ⛔ Forbidden |
| Book Free & Paid Tickets |  Allowed |  Allowed |  Allowed |  Allowed |
| Download Ticket PDF |  Allowed (Admin Inspection) | ⛔ Own Bookings Only | ⛔ Own Bookings Only |  Allowed (Own Bookings) |

---

## 6. Safe Account Reset & Teardown Guidelines

- **Never drop or truncate database tables directly** on shared cloud or staging environments.
- To clean up test bookings created during QA runs:
  - In integration tests, use the automated transaction rollback or dedicated test fixtures.
  - In E2E tests, `e2e/global-teardown.ts` selectively cleans up rows prefixed with `E2E-` or tagged with test identifiers without wiping the database.
- To reset a test user's password:
  - Visit `/forgot-password`, enter the test email, and follow the password recovery flow.
  - Or update the password via the Supabase Admin API / CLI without touching production data.
