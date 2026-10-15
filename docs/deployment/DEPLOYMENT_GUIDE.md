# EventDeck Production Deployment Guide

This guide covers deploying EventDeck to Vercel, configuring hosted Supabase PostgreSQL, setting up custom domains (`eventdeck.online`), Brevo SMTP email delivery, and production cron triggers.

---

## 1. Prerequisites & Services

1. **Vercel Account**: For hosting the Next.js App Router application.
2. **Supabase Cloud Project**: Dedicated PostgreSQL database, Auth, Storage, and Realtime.
3. **Domain Registrar / DNS**: For configuring `eventdeck.online`.
4. **Brevo Account**: For reliable SMTP transactional email delivery.

---

## 2. Vercel Project Configuration

1. Import the repository into Vercel.
2. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Node.js Version**: `22.x` or `24.x`

---

## 3. Environment Variables (Vercel)

Set the following environment variables in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Target | Description | Example |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` (or `NEXT_PUBLIC_SITE_URL`) | Production | Canonical public URL | `https://eventdeck.online` |
| `NEXT_PUBLIC_UNIVERSITY_NAME` | All | Branding subtitle | `"SRM University, KTR Campus"` |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase Project URL | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All | Supabase publishable key (legacy fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Production | Supabase secret key (legacy fallback: `SUPABASE_SERVICE_ROLE_KEY`) — server-only | `sb_secret_...` |
| `DATABASE_URL` | Production | Supabase Transaction Pooler (Port 6543) | `postgresql://postgres.<ref>:pass@aws-0-....pooler.supabase.com:6543/postgres` |
| `DIRECT_URL` | Migrations only | Supabase Session Pooler (Port 5432) — used by `npm run db:migrate` from a trusted machine | `postgresql://postgres.<ref>:pass@aws-0-....pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Production | Razorpay Test Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_ID` | Production | Razorpay Test Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Production | Razorpay Test Secret Key | `...` |
| `RAZORPAY_WEBHOOK_SECRET` | Production | Razorpay Webhook Secret | `...` |
| `CRON_SECRET` | Production | Bearer token for Vercel Cron | Random 64-char hex string |

> **Security Note**: Never enable `ALLOW_MOCK_PAYMENTS=true` in production. Live Razorpay keys (`rzp_live_...`) are automatically refused by EventDeck's runtime safety guard.

---

## 4. Custom Domain Configuration (`eventdeck.online`)

1. In Vercel: **Project Settings → Domains → Add `eventdeck.online`**.
2. Add exactly the DNS records Vercel shows for the domain (Vercel's recommended A-record IP has changed over time, so copy it from the dashboard rather than from documentation).
3. Wait for SSL certificate issuance (managed automatically by Vercel).
4. If a `www` record exists, also add `www.eventdeck.online` to the Vercel project (set to redirect to the apex). As of 15 Oct 2026 public DNS has `www` pointing at the site but its HTTPS certificate does not cover `www`, so `https://www.eventdeck.online` shows a certificate error.

Current state (public DNS / HTTP check, 15 Oct 2026): `eventdeck.online` is served by Vercel (HTTP 200) and `https://eventdeck.vercel.app` redirects (307) to `https://eventdeck.online`.

---

## 5. Brevo SMTP Integration with Supabase Auth

To ensure reliable delivery of password reset and confirmation emails:

1. **In Brevo**:
   - Open **SMTP & API → SMTP** and note the SMTP server (`smtp-relay.brevo.com`), port (`587`) and **login**, then generate an **SMTP key**. The SMTP key is the password; the API key (`xkeysib-…`) will not work.
   - Authenticate the domain `eventdeck.online` under **Senders, Domains & Dedicated IPs** (Brevo code TXT record, DKIM CNAMEs `brevo1._domainkey` and `brevo2._domainkey`, DMARC). All of these are present in public DNS as of 15 Oct 2026; there is no SPF record, so DMARC passes through DKIM alignment.
   - Add and verify the sender `noreply@eventdeck.online`.
2. **In Supabase Dashboard**:
   - Navigate to **Authentication → Emails → SMTP Settings**.
   - Toggle **Enable Custom SMTP**.
   - Fill in:
     - Sender Email: `noreply@eventdeck.online`
     - Sender Name: `Event Deck`
     - Host: `smtp-relay.brevo.com`
     - Port: `587`
     - Username: Brevo SMTP login; Password: Brevo SMTP key. These stay in Supabase only, never in Vercel, `.env.local` or Git.
   - Keep the template variables in **Authentication → Emails → Templates** intact (`{{ .ConfirmationURL }}`, or the token-hash form described in [WINDOWS_SETUP_AND_RUN.md §7](../WINDOWS_SETUP_AND_RUN.md#7-brevo-smtp-and-authentication-emails)).
3. **Redirect URLs**:
   - Under **Authentication → URL Configuration**:
     - Site URL: `https://eventdeck.online`
     - Redirect URLs: `https://eventdeck.online/**` and `http://localhost:3000/**`

---

## 6. Vercel Cron Jobs

The repository includes a `vercel.json` defining the background hold-expiry cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-holds",
      "schedule": "0 3 * * *"
    }
  ]
}
```

The job runs daily at 03:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>` when the `CRON_SECRET` environment variable is set in the project. Holds also expire lazily whenever bookings are read, so correctness does not depend on the cron.

---

## 7. Database Migrations in Production

1. Review every new file in `drizzle/` before applying it.
2. From a trusted machine with the production `DIRECT_URL` in `.env.local`, run `npm run db:migrate` **before** deploying code that depends on the change.
3. Never reset the database, drop tables or delete data in production.
4. Note: `0008_root_admin_protection.sql` has already been applied to the production project manually, but drizzle-kit has not recorded it there (8 recorded migrations as of 15 Oct 2026). The next `npm run db:migrate` will run it again, which is safe because it is idempotent.

## 8. Post-Deployment Smoke Test

Home page and search; sign-up with a real inbox (the e-mail arrives from `noreply@eventdeck.online` and the link returns to `https://eventdeck.online`); sign-in; a free booking; a paid booking with a Razorpay test card; PDF ticket download; password reset; `/admin` as an administrator.
