# EventDeck Troubleshooting & Diagnostic Guide

This guide provides root-cause explanations and practical resolutions for common development, deployment, and operational issues in EventDeck. For Windows-specific installation problems (PowerShell execution policy, ports, `.env.local` naming), see the table in [WINDOWS_SETUP_AND_RUN.md §10](../WINDOWS_SETUP_AND_RUN.md#10-windows-troubleshooting).

---

## 1. Database & Connection Issues

### Issue 1.1: Migrations Fail with `Prepared statement already exists` or Timeout
- **Root Cause**: Drizzle migrations execute DDL commands (`CREATE TABLE`, `ALTER TABLE`) which require a direct connection or session pooler (port 5432). Transaction poolers (port 6543) do not support all DDL operations.
- **Resolution**:
  - Verify that `DIRECT_URL` in `.env.local` points to port `5432` with connection pooling disabled.
  - Run migrations using:
    ```bash
    npm run db:migrate
    ```

### Issue 1.2: Pages Hang (Especially `/admin`) or Fail with `Cannot read properties of undefined (reading 'map')`
- **Root Cause**: When a request runs more concurrent queries than the pool size, postgres.js pipelines extra queries onto busy connections by default. Through Supabase's **transaction pooler** (port 6543), pipelined queries hang or come back mixed up. The admin layout runs ten counter queries at once, so admin pages stalled for minutes and blocked later sign-ins.
- **Resolution** (already in the code):
  - `src/db/index.ts` creates the pool with `max_pipeline: 0` (one query per connection at a time) and `prepare: false`. Measured: with pipelining on, 91 of 200 concurrent queries timed out; with it off, 200 of 200 completed in about 1.9 s.
  - Always import `{ db } from "@/db"` instead of creating new `postgres()` clients. If you must create one (scripts, tests), pass `max_pipeline: 0` as well.
  - After changing `src/db/index.ts`, restart `npm run dev`: the pool is cached on `globalThis` across hot reloads.

---

## 2. Authentication & Email Redirects

### Issue 2.1: Password Reset or Email Confirmation Redirects to `localhost` in Production
- **Root Cause**: The Supabase project's **Site URL** or **Redirect URLs** are configured to `http://localhost:3000` rather than `https://eventdeck.online`.
- **Resolution**:
  1. Open Supabase Dashboard → **Authentication → URL Configuration**.
  2. Set **Site URL** to `https://eventdeck.online`.
  3. Add `https://eventdeck.online/**` (and `http://localhost:3000/**` for local development) to **Redirect URLs**. The wildcard covers `/auth/confirm` with its `next` query.
  4. Ensure `NEXT_PUBLIC_APP_URL=https://eventdeck.online` in Vercel. On Vercel production the code uses `https://eventdeck.online` regardless (`src/lib/url.ts`).

### Issue 2.1a: E-mail Link Opens a Vercel Login Screen or a `*.vercel.app` Address
- **Root Cause**: The link points at a preview deployment protected by Vercel Deployment Protection, usually because the Supabase **Site URL** was set to a preview URL or an old deployment sent the e-mail.
- **Resolution**: Set the Site URL to `https://eventdeck.online` and redeploy production. Current code never builds e-mail links from a `*.vercel.app` URL in production.

### Issue 2.1b: "Email confirmation failed or link has expired"
- **Root Causes**: (1) the one-time token was already used or expired; (2) the default `{{ .ConfirmationURL }}` link returns `?code=…`, which can only be exchanged in the same browser that started the sign-up or reset; (3) a mail scanner opened the link first.
- **Resolution**: Request a new e-mail. For links that work across devices, use the token-hash template form that `/auth/confirm` supports (see [WINDOWS_SETUP_AND_RUN.md §7](../WINDOWS_SETUP_AND_RUN.md#7-brevo-smtp-and-authentication-emails)). In case (2) the e-mail is already confirmed, so the user can simply sign in.

### Issue 2.1c: No Confirmation or Reset E-mail Arrives
- **Check in order**: Supabase → Logs → Auth (SMTP errors), Supabase → Authentication → Rate Limits (e-mails per hour), Brevo → Transactional → Logs (sent, delivered, bounced), the spam folder, and Brevo domain authentication for `eventdeck.online` (DKIM, DMARC).
- **SMTP credentials** belong only in Supabase → Authentication → Emails → SMTP Settings. The password is the Brevo **SMTP key**, not the API key. Never place them in `.env.local` or Vercel.

### Issue 2.2: Cannot Modify or Deactivate `eventdeck88@gmail.com`
- **Root Cause**: By design, `eventdeck88@gmail.com` is the system **Root Administrator**.
- **Resolution**:
  - The account is protected by database triggers (`protect_root_admin()`) and application-level authorization guards. It cannot be demoted, deactivated, or deleted by any user or administrator.
  - To change its password, use the standard Forgot Password workflow at `/forgot-password`.

---

## 3. Payments & Razorpay

### Issue 3.1: Live Keys Rejected at Startup
- **Root Cause**: EventDeck explicitly refuses live Razorpay keys (`rzp_live_...`) to prevent accidental financial transactions in university staging/testing environments.
- **Resolution**:
  - Use test keys (`rzp_test_...`) from the Razorpay Dashboard in Test Mode.
  - For local development without Razorpay keys, enable the mock simulator: `ALLOW_MOCK_PAYMENTS=true`.

---

## 4. Check-in & QR Camera Scanner

### Issue 4.1: Camera Access Refused on Mobile Device
- **Root Cause**: Modern mobile browsers (iOS Safari, Android Chrome) block camera access (`getUserMedia`) on unencrypted HTTP connections.
- **Resolution**:
  - Camera access requires **HTTPS**.
  - For local mobile testing, use an HTTPS tunnel, or type the ticket number (format `XXXX-XXXX-XXXX`, for example `RRAE-BVZQ-W8PL`, shown on the ticket) into the manual entry field on the scanner.

---

## 5. Next.js 16 Framework Conventions

### Issue 5.1: Why is there a `src/proxy.ts` instead of `middleware.ts`?
- **Explanation**: Next.js 16 introduces `proxy.ts` as the standard request interception and routing gateway convention, deprecating `middleware.ts`.
- **Verification**: Next.js 16 automatically detects `src/proxy.ts`. Do not rename it back to `middleware.ts`.

---

## 6. Security Notes

### Issue 6.1: Redirect After Login Goes Somewhere Unexpected
- `next` parameters on `/login` and `/auth/confirm` pass through `safeRedirectPath()` (`src/lib/url.ts`). Anything other than a same-site path, including `//host` and `/\host`, is ignored and the user goes to their home page. This closes an open redirect that the earlier `startsWith("/")` check allowed.

### Issue 6.2: Passwords Visible in the Dev Server Log
- Next.js 16 logs Server Function arguments during development, which included the sign-in password. `next.config.ts` now sets `logging.serverFunctions: false`. If you saw a password in an old terminal log, change that password.
