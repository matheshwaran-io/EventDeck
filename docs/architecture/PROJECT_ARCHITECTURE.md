# EventDeck System Architecture

## 1. Executive Summary

EventDeck is a university-scale event management and ticketing platform designed for high concurrency, reliable inventory allocation, and multi-tier access control. It operates as a full-stack Next.js application integrated with Supabase (PostgreSQL, Authentication, Realtime, Storage) and Razorpay payment services.

---

## 2. Technology Stack

- **Framework**: Next.js 16.4.0 (App Router, Turbopack, React 19 Server Components)
- **Language**: TypeScript 5.x (Strict mode)
- **Styling**: Tailwind CSS v4, Base UI / Radix primitives, Lucide React icons
- **Database**: Hosted Supabase PostgreSQL
- **ORM / Migrations**: Drizzle ORM 0.45.x, Drizzle Kit
- **Authentication**: Supabase Auth (with SSR cookie exchange, Brevo SMTP integration)
- **Payment Processing**: Razorpay Test Mode (with server-side signature verification & local fallback simulator)
- **Document Generation**: pdf-lib, qrcode (PDF ticket generation with private storage caching)
- **Check-in Scanning**: html5-qrcode (client-side video capture with server validation)
- **Testing**: Vitest (Unit & Integration), Playwright (End-to-End)

---

## 3. High-Level Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                               │
│  Browser / Mobile Viewports (React 19, Server Components, Base UI)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / HTTPS (Session Cookies)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION TIER                            │
│  Next.js 16 Server Runtime                                             │
│                                                                        │
│  ├── src/proxy.ts (Session refresh & gatekeeper redirects)             │
│  ├── Server Actions (src/app/actions/*)                                │
│  │   ├── Pre-flight authorization (requireUser, requirePageUser)       │
│  │   └── Input validation (Zod schemas in src/lib/validation/*)        │
│  └── Backend Services (src/lib/server/*)                               │
│      ├── Transactional business logic                                  │
│      └── Audit logging & notifications                                 │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
    Drizzle ORM     │                                │ Supabase Auth SDK
    (Port 6543 /    │                                │ & Service Role Key
     Port 5432)     ▼                                ▼
┌──────────────────────────────────┐   ┌─────────────────────────────────┐
│          DATABASE TIER           │   │         EXTERNAL SERVICES       │
│  Hosted Supabase PostgreSQL      │   │                                 │
│  ├── Public schema (Drizzle ORM) │   │  ├── Supabase Auth (Brevo SMTP) │
│  ├── Row Level Security (RLS)    │   │  ├── Supabase Storage (Private) │
│  ├── Postgres Triggers           │   │  ├── Razorpay Gateway (Test)    │
│  └── Atomic inventory guards     │   │  └── Supabase Realtime Engine   │
└──────────────────────────────────┘   └─────────────────────────────────┘
```

---

## 4. Security & Access Control Model

### 4.1. Defense in Depth
1. **Network & Session Layer (`src/proxy.ts`)**:
   - Intercepts requests to protected path prefixes (`/my`, `/organizer`, `/admin`, `/moderate`).
   - Refreshes session tokens via Supabase Auth SSR.
   - Redirects unauthenticated users to `/login?next=...`.

2. **Application Server Layer (`src/lib/auth.ts`)**:
   - `requirePageUser(roles)` and `requireUser(roles)` enforce server-side authentication and role requirements.
   - User identity is verified against `public.profiles` using the verified Supabase Auth user ID.
   - **Root Administrator Guarantee**: Account `eventdeck88@gmail.com` is hardcoded as an immutable, permanent administrator.

3. **Database Layer (Row Level Security & Database Triggers)**:
   - All tables in schema `public` have Row Level Security enabled.
   - `anon` and `authenticated` roles have `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` revoked on core tables.
   - All mutations execute through trusted server-side transactions using Drizzle ORM.
   - Database triggers (`protect_root_admin()`, `protect_auth_root_admin()`) prevent deletion, demotion, deactivation, or email alteration of the root admin account at the database engine level.

---

## 5. Role Hierarchy & RBAC

| Role | Discovery & Booking | Organizer Dashboard | Admin Console | Event Check-in |
| :--- | :---: | :---: | :---: | :---: |
| **Participant** | Yes | No | No | Only if assigned moderator |
| **Organizer** | Yes | Yes (Owned events) | No | Yes (Owned events + assigned) |
| **Administrator** | Yes | Yes (All events) | Yes | Yes (All events) |
| **Root Admin** | Yes | Yes (All events) | Yes (Permanent) | Yes (All events) |

---

## 6. Inventory Allocation & Concurrency Control

EventDeck avoids overselling and race conditions through transactional database locking:

1. **Atomic SQL Allocation**:
   ```sql
   UPDATE ticket_tiers
   SET allocated = allocated + $requested
   WHERE id = $tier_id AND allocated + $requested <= capacity;
   ```
2. **Deterministic Locking Order**:
   - When a booking reserves multiple tiers, tiers are sorted by ID before acquiring row locks, eliminating deadlocks.
3. **10-Minute Hold Window**:
   - Bookings in `awaiting_payment` hold inventory for exactly 10 minutes (`HOLD_MINUTES = 10`).
   - Expiration occurs lazily on booking reads and proactively via daily background cron (`/api/cron/expire-holds`).

---

## 7. Status State Machine

Allowed moves are defined in `src/lib/domain/transitions.ts` and applied with compare-and-set updates (`UPDATE … WHERE status IN (expected)`), so concurrent requests cannot move a booking twice.

| How the booking starts | Initial status | What happens next |
| --- | --- | --- |
| **Free** tier | `approved` (tickets issued in the same transaction) | — |
| **Paid** tier | `awaiting_payment` (seats held 10 minutes) | Verified payment → `approved` + tickets; no payment → `expired`; participant cancels → `cancelled` |
| **Complimentary pass** request | `pending_verification` | Organizer approves → `approved` + tickets; organizer rejects → `rejected` (seats released) |

- A payment that arrives after a hold has `expired` or been `cancelled` re-allocates the seats if they are still free (→ `approved`). Otherwise the booking becomes `payment_exception` for an administrator; a paid booking is never silently dropped.
- Approving the cancellation of an event moves every live booking to `event_cancelled`, invalidates its tickets and queues a refund for paid ones.

Independent fields:

1. **`bookings.status`**: `awaiting_payment`, `pending_verification`, `approved`, `rejected`, `cancelled`, `expired`, `event_cancelled`, `payment_exception`.
2. **`bookings.payment_status`**: `not_required`, `pending`, `paid`, `failed`, `expired`.
3. **`tickets.status`**: `valid`, `invalidated` (check-in recorded once in `check_ins`, unique per ticket).
4. **`bookings.refund_status` / `refunds.status`**: `not_applicable`, `pending`, `processed`, `failed`.

A ticket is valid only when the booking is `approved`, payment is `paid` or `not_required`, and the event is not cancelled. This is re-checked at PDF download and at every scan.

---

## 8. Database Connections

- `src/db/index.ts` creates one postgres.js pool (`max` 10 in development, 5 in production) over `DATABASE_URL`, which is Supabase's **transaction pooler** (port 6543). It uses `prepare: false` (no named prepared statements through the pooler) and **`max_pipeline: 0`**.
- `max_pipeline: 0` matters. By default postgres.js pipelines extra queries onto busy connections once a request runs more concurrent queries than `max`. Through the transaction pooler, those pipelined queries hung or returned mismatched results: the admin pages, which run ten counters at once in the layout, stalled for minutes. With pipelining off, 200 of 200 concurrent test queries completed in about 1.9 s (versus 91 of 200 timing out), and every admin page loads in about 1.2–2.1 s.
- `adminMetrics()` is wrapped in React `cache()`, so the admin layout and overview page share one set of counter queries per request.
- Migrations use `DIRECT_URL`, Supabase's **session pooler** (port 5432), through `drizzle.config.ts`.

---

## 9. Authentication Links and Redirects

- Sign-up sends `emailRedirectTo = getAuthRedirectUrl("/auth/confirm")`; password reset sends `getAuthRedirectUrl("/auth/confirm?next=/reset-password")` (`src/app/actions/auth.ts`).
- `getAppUrl()` (`src/lib/url.ts`) returns `https://eventdeck.online` on Vercel production. Otherwise it returns `NEXT_PUBLIC_APP_URL` (a `*.vercel.app` value is ignored in production builds), then `VERCEL_URL`, then `http://localhost:3000`.
- `/auth/confirm` accepts `token_hash` + `type` (`verifyOtp`) or `code` (`exchangeCodeForSession`).
- Every post-login and post-confirmation redirect goes through `safeRedirectPath()`, which allows only same-site paths. It rejects `//host`, backslash forms such as `/\host` (which browsers treat as another host), absolute URLs and control characters.
- Supabase sends the e-mails through Brevo SMTP configured in the Supabase dashboard; the application holds no SMTP credentials.

---

## 10. Directory Map

| Path | Contents |
| --- | --- |
| `src/proxy.ts` | Session refresh and signed-out redirects |
| `src/app/(site)`, `src/app/(auth)` | Public pages; sign-in, sign-up and password pages |
| `src/app/my`, `organizer`, `moderate`, `admin` | Participant, organizer, moderator and administrator areas |
| `src/app/actions`, `src/app/api` | Server Actions; route handlers (check-in, payments, Razorpay webhook, tickets, reports, cron) |
| `src/lib/domain` | Pure rules (eligibility, pricing, transitions, tokens), unit-tested |
| `src/lib/server` | Database services with authorization and transactions |
| `src/db` | Drizzle schema and connection |
| `drizzle/` | SQL migrations `0000`–`0008` |
