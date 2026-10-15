# EventDeck on Windows — Setup, Run, Test and Troubleshoot

A step-by-step manual for Windows 10 and Windows 11. It assumes no previous experience with Node.js, npm, PowerShell or Supabase. All commands are **PowerShell** commands unless stated otherwise.

> **Verification status.** The commands and file names in this manual were checked against the repository and run on macOS (Node.js 24.16, npm 11.13): install, development server, lint, type check, unit tests, production build and production start. They have **not yet been run on a Windows machine**. §13 gives a short procedure for confirming them on Windows. The npm scripts use `cross-env` so they work in Windows `cmd.exe` and PowerShell.

---

## 1. Overview

**What EventDeck is.** EventDeck is a web application for running university events. Participants (SRM students, faculty, alumni, students of other colleges and guests) discover events and book free or paid tickets. Each ticket has a QR code and a PDF pass. Organizers create events with ticket tiers, capacities, registration and check-in windows and audience rules (campus-only, inter-campus, approved colleges, open). They appoint event moderators and scan tickets at the entrance. Administrators handle organizer applications, cancellations, refunds, payment exceptions, payouts, reports and the audit log.

**Technologies used** (from `package.json`):

| Area | Technology |
| --- | --- |
| Web framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui components on Base UI |
| Data access | Drizzle ORM 0.45 + `postgres` (postgres.js) driver, drizzle-kit migrations |
| Validation | Zod 4, React Hook Form |
| Tickets | `qrcode`, `pdf-lib`, `html5-qrcode` (camera scanner), `sharp` (poster compression) |
| Tests | Vitest (unit + integration), Playwright (end-to-end) |
| Package manager | **npm** (the repository has a `package-lock.json`) |

**What runs where**

| Runs on your PC | Hosted (external) |
| --- | --- |
| The Next.js development server (`http://localhost:3000`) | **Supabase**: PostgreSQL database, Auth (accounts, sessions, e-mails), Storage (posters, ticket PDFs), Realtime |
| Lint, type check, unit tests, production build | **Brevo**: SMTP relay that Supabase uses to send sign-up and password-reset e-mails |
| | **Razorpay** (Test Mode only): payments and refunds |
| | **Vercel**: production hosting at `https://eventdeck.online` |

There is **no local database**. Your local server connects to a hosted Supabase project over the internet. Docker and a local PostgreSQL install are not needed.

---

## 2. Prerequisites

| Requirement | Version | Why |
| --- | --- | --- |
| Windows | 10 (64-bit) or 11 | — |
| Node.js | **20.9 or newer** is required by Next.js 16; **24 LTS is recommended** (the project is developed on 24.x) | Runs the app and all tools |
| npm | Comes with Node.js (npm 10+) | Installs dependencies from `package-lock.json` |
| Git | Any recent Git for Windows | Downloads the code |
| Code editor | Visual Studio Code (free) recommended | Editing `.env.local` and code |
| Supabase project | Access to the EventDeck project, or your own free project (§6) | Database, auth and storage |
| Internet connection | — | npm downloads and every database call |

Not required: Docker, PostgreSQL, Python, WSL, or any paid software.

### 2.1 Install Node.js

1. Open <https://nodejs.org> and download the **LTS** Windows Installer (`.msi`), version 24.x.
2. Run it and accept the defaults. You do not need the optional "Tools for native modules" (Chocolatey) step: the native packages this project uses (`sharp`) download prebuilt Windows binaries.
3. **Close every PowerShell window and open a new one**, so the updated `PATH` is picked up.

### 2.2 Install Git

1. Download Git for Windows from <https://git-scm.com/download/win> and install with the defaults.
2. Open a new PowerShell window.

### 2.3 Install Visual Studio Code (optional, recommended)

Download from <https://code.visualstudio.com/> and install. Tick **"Add 'Open with Code' action"** if you want the right-click menu entry.

### 2.4 Check the installations

Open **PowerShell** (Start menu → type `PowerShell` → *Windows PowerShell* or *Terminal*) and run each command:

```powershell
node --version
```

```powershell
npm --version
```

```powershell
git --version
```

Expected: `v24.x.x` (anything from `v20.9.0` up works), an npm version such as `11.x.x`, and `git version 2.x`. If a command is "not recognized", see §10.

---

## 3. Download the project

Choose a short folder path **outside OneDrive** (OneDrive syncing `node_modules` is slow and can lock files), for example `C:\dev`.

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
```

```powershell
Set-Location C:\dev
```

```powershell
git clone https://github.com/Eventdeck88/EventDeck.git
```

```powershell
Set-Location C:\dev\EventDeck
```

The repository is private to its team. If `git clone` asks you to sign in, use your GitHub account that has access. If you work from your own fork, use your fork's URL from GitHub's green **Code** button.

You should now see these top-level folders and files (`Get-ChildItem`):

```
drizzle\            SQL migrations (applied with drizzle-kit)
docs\               documentation (this manual)
e2e\                Playwright end-to-end tests
public\             static files (logo, icons)
scripts\            seed and admin scripts
src\                application source code
tests\              Vitest unit and integration tests
.env.example        template for your local settings
package.json        npm scripts and dependencies
package-lock.json   exact dependency versions
```

**Open in VS Code:** run `code .` in the project folder, or in VS Code use *File → Open Folder…* → `C:\dev\EventDeck`. Open a terminal inside VS Code with **Terminal → New Terminal** (`` Ctrl+` ``). It starts in the project folder automatically. Every command below must be run from the folder that contains `package.json`. Check with `Test-Path package.json`, which should print `True`.

---

## 4. Install dependencies

Use the lockfile for an exact, clean install:

```powershell
npm ci
```

`npm ci` installs exactly what `package-lock.json` lists. Use `npm install` only when you intend to add or change a dependency, because that updates the lockfile.

**Success looks like** a final line such as `added 6xx packages in 40s` with no `ERR!` lines. Warnings (`npm warn deprecated …`) are normal. A `node_modules` folder now exists.

Optional: to run the browser tests later, download Playwright's Chromium once:

```powershell
npx playwright install chromium
```

### Install problems on Windows

| Symptom | Fix |
| --- | --- |
| `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system` | PowerShell's execution policy blocks npm's PowerShell shim. Either run `npm.cmd ci` (works without changing anything), or allow signed/local scripts for your user only: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. Do not use `Unrestricted` or `Bypass` machine-wide. |
| `'node' is not recognized` / `'npm' is not recognized` | Node.js is not installed or the window was opened before installation. Reinstall from nodejs.org and open a **new** window. |
| `npm ERR! engine` or `Unsupported engine` / Next.js says Node is too old | Install Node.js 24 LTS (20.9 minimum). Check with `node --version`. |
| `npm ERR! code ENOENT ... package.json` | You are in the wrong folder. `Set-Location C:\dev\EventDeck`. |
| `npm ci` says the lockfile and `package.json` are out of sync | Someone changed `package.json` without updating the lockfile. Run `npm install` once (this updates `package-lock.json`) and tell the team. Do **not** delete `package-lock.json`. |
| `ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, `self-signed certificate in certificate chain` | Network, firewall or corporate proxy problem. Retry on another network, or configure the proxy: `npm config set proxy http://proxy:port` and `npm config set https-proxy http://proxy:port`. Do not disable SSL verification. |
| `EPERM: operation not permitted, unlink …` / `EBUSY` | A file in `node_modules` is locked by an editor, antivirus or OneDrive. Stop `npm run dev`, close other terminals, move the project out of OneDrive and run `npm ci` again. |
| `sharp` install error | Make sure you are on 64-bit Node.js (`node -p "process.arch"` should print `x64` or `arm64`) and retry `npm ci`. |

---

## 5. Environment configuration

The app reads its settings from a file named **`.env.local`** in the project folder. Git ignores it, so it is never committed. The full reference for every variable is [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

### 5.1 Create `.env.local`

```powershell
Copy-Item .env.example .env.local
```

```powershell
code .env.local
```

(or `notepad .env.local`)

**Hidden-extension trap:** Windows hides file extensions by default, and Notepad's *Save As* can produce `.env.local.txt`, which the app ignores. Check the real name with:

```powershell
Get-ChildItem -Force -Name .env*
```

You must see exactly `.env.local`. If you see `.env.local.txt`, rename it with `Rename-Item .env.local.txt .env.local`.

Format rules: one `NAME=value` per line, no spaces around `=`, and no quotes unless the value contains spaces. Save the file as UTF-8 (VS Code's default).

### 5.2 What to fill in

| Variable | Required locally? | Public / server-only | Value |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public | `http://localhost:3000` |
| `NEXT_PUBLIC_UNIVERSITY_NAME` | Optional | Public | Leave the default |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Public | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Public | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Yes (posters, PDFs, scripts) | **Server-only secret** | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) |
| `DATABASE_URL` | **Yes** | **Server-only secret** | Supabase → **Connect** → *Transaction pooler* (port **6543**). Replace `[YOUR-PASSWORD]` with the database password. |
| `DIRECT_URL` | Yes, for migrations | **Server-only secret** | Supabase → **Connect** → *Session pooler* (port **5432**) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Optional | Key id public; secrets server-only | Razorpay Dashboard in **Test Mode** (`rzp_test_…` only) |
| `ALLOW_MOCK_PAYMENTS` | Optional | Server-only | `true` to use the built-in payment simulator when you have no Razorpay keys |
| `CRON_SECRET` | Optional locally | Server-only secret | Any long random string |
| `SEED_DEMO_PASSWORD` | Only for `npm run db:seed` | Local only | A password for the fictional demo accounts |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Only for `npm run admin:create` | Local only | — |

If the database password contains special characters (`@ : / ? # %`), percent-encode them in the URL (for example `@` becomes `%40`).

**Never** put a secret into a variable whose name starts with `NEXT_PUBLIC_`: those values are sent to every browser. Never commit `.env.local`, and never paste its contents into chat, issues or screenshots.

**What stops working when something is missing**

| Missing | Effect |
| --- | --- |
| `DATABASE_URL` | Every page that reads data fails ("DATABASE_URL is not configured") |
| Supabase URL or public key | Sign-in, sign-up and sessions fail |
| `SUPABASE_SECRET_KEY` | Poster upload, ticket PDF download and the admin/seed scripts fail |
| Razorpay keys (and simulator off) | Paid checkout cannot start; free events still work |
| `CRON_SECRET` | Only the scheduled hold-expiry endpoint refuses requests; holds still expire lazily |

---

## 6. Supabase setup

### 6.1 Which project to use

- **Joining the existing team:** ask the project owner for the URL, keys and database connection strings of the EventDeck Supabase project, or for an invitation to the Supabase organization. Do **not** run migrations or seed scripts against the shared project without agreeing it with the team.
- **Your own sandbox (recommended for experiments):** create a free project at <https://supabase.com/dashboard>, note the database password, then fill `.env.local` with its values and continue below.

### 6.2 Create the schema (own project only)

```powershell
npm run db:migrate
```

This applies the SQL files in `drizzle\` in order (`0000` … `0008`): tables, constraints, indexes, the sign-up trigger, Row-Level Security policies, the Realtime publication for `bookings` and `notifications`, the `posters` (public) and `tickets` (private) Storage buckets, and the root-admin protection triggers. Migrations are recorded, so running the command again only applies new files.

> Migration `0008_root_admin_protection.sql` was applied to the main hosted project by hand, and drizzle-kit has not recorded it there. Running `npm run db:migrate` against that project will execute it once more. It is written to be re-runnable (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`), but still agree with the team before migrating a shared database.

Optional demo data (fictional accounts and events, password = `SEED_DEMO_PASSWORD`). Use it only on a fresh project:

```powershell
npm run db:seed
```

Optional first administrator (admin rights cannot be obtained through the website):

```powershell
$env:ADMIN_EMAIL = "you@example.com"; $env:ADMIN_NAME = "Your Name"; npm run admin:create
```

Without `ADMIN_PASSWORD`, a strong password is generated and printed **once**. Store it in a password manager.

> **Never** run destructive commands (resetting the database, dropping schemas or tables, deleting users) against a project that holds real data, and never point tests at it. Tests use a separate project (§9.3).

### 6.3 Authentication settings (Supabase dashboard)

**Authentication → Sign In / Providers → Email:** keep e-mail/password enabled. **Confirm email** should stay **on** for the real project (see the warning below). For a throw-away sandbox you may turn it off so new accounts can sign in immediately.

> The root administrator account is matched by e-mail address (`eventdeck88@gmail.com`, see `src/lib/constants.ts`), and the sign-up trigger grants it admin rights. Keep **Confirm email** enabled on any project where this account does not exist yet. Otherwise, whoever signs up with that address first becomes an administrator.

**Authentication → URL Configuration**

| Setting | Value |
| --- | --- |
| Site URL | `https://eventdeck.online` (production). In a personal sandbox: `http://localhost:3000` |
| Redirect URLs | `https://eventdeck.online/**` and `http://localhost:3000/**` |

**How the e-mail links reach the app (verified in the code):**

- Sign-up passes `emailRedirectTo = <base>/auth/confirm` (`src/app/actions/auth.ts`).
- Password reset passes `redirectTo = <base>/auth/confirm?next=/reset-password`.
- `<base>` comes from `getAppUrl()` in `src/lib/url.ts`: always `https://eventdeck.online` on Vercel production, otherwise `NEXT_PUBLIC_APP_URL`, then `http://localhost:3000`. A `*.vercel.app` value is ignored in production, so e-mails never point at a temporary preview deployment.
- The route `src/app/auth/confirm/route.ts` accepts either `?token_hash=…&type=…` (verified with `verifyOtp`) or `?code=…` (exchanged for a session). It then redirects to `next` (same-site paths only) or, on failure, to `/login?error=confirmation` or `/login?error=recovery`.

**RLS and Storage:** both are created by the migrations. Row-Level Security is enabled on all 17 tables, the browser key cannot insert, update or delete anything, and every write goes through the server. Do not weaken policies to "fix" an error; see §10.

---

## 7. Brevo SMTP and authentication e-mails

Authentication e-mails (sign-up confirmation, password reset) are sent **by Supabase Auth** through **Brevo SMTP**. The EventDeck code does not send e-mail and has no SMTP settings, so:

| Where | What you configure |
| --- | --- |
| **Your PC (`.env.local`)** | Nothing for e-mail. Only `NEXT_PUBLIC_APP_URL` affects the links. |
| **Supabase → Authentication → Emails → SMTP Settings** | Custom SMTP enabled; host `smtp-relay.brevo.com`; port `587`; username = your **Brevo SMTP login**; password = a **Brevo SMTP key**; sender e-mail `noreply@eventdeck.online`; sender name `Event Deck` |
| **Supabase → Authentication → Emails → Templates** | The branded *Confirm signup* and *Reset password* templates |
| **Brevo → Senders, Domains & Dedicated IPs** | `eventdeck.online` authenticated (the Brevo code TXT, the `brevo1`/`brevo2._domainkey` DKIM CNAMEs and DMARC are present in public DNS); sender `noreply@eventdeck.online` verified |

Important rules:

- The SMTP password is the **SMTP key** from Brevo → *SMTP & API* → **SMTP** tab. It is **not** the Brevo API key (`xkeysib-…`).
- SMTP credentials stay in the Supabase dashboard. Never put them in `.env.local`, in Vercel, in a `NEXT_PUBLIC_` variable or in Git.
- Keep the template variables intact. The default templates link with `{{ .ConfirmationURL }}`. That link goes to Supabase first and then to the app's `/auth/confirm?code=…`; the code can only be exchanged **in the same browser** that started the sign-up or reset. Links opened on another device verify the e-mail but land on "Email confirmation failed or link has expired", although the user can still sign in.
- For links that work on any device, the app also supports the token-hash form, which `/auth/confirm` verifies directly:
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

  Check which form the branded templates use before changing them, and test both flows afterwards.
- Supabase limits how many e-mails are sent per hour (**Authentication → Rate Limits**). Raise it there if sign-ups are throttled.

**Telling e-mail problems apart**

| What you see | Likely layer | Check |
| --- | --- | --- |
| Sign-up/reset shows an error immediately, e.g. "Error sending confirmation email" | **SMTP**: wrong host, port, login or key, or Brevo account restriction | Supabase → Logs → Auth logs; re-enter the SMTP key; Brevo → Transactional → Logs |
| Supabase says sent, Brevo log shows *sent/delivered*, nothing in inbox | **Delivery / DNS authentication** | Spam folder; Brevo domain status (DKIM/DMARC green); the recipient's server |
| E-mail arrives but looks wrong or the link is missing | **Template** | Restore `{{ .ConfirmationURL }}` or the token-hash link exactly |
| Link opens a **Vercel login** page | **Vercel Deployment Protection**: the link points at a protected preview deployment | Site URL must be `https://eventdeck.online`; redeploy production so `getAppUrl()` is current |
| Link opens `localhost` from production | **Site URL / redirect** misconfiguration | Site URL and `NEXT_PUBLIC_APP_URL` in Vercel |
| "link has expired" | **Token expired or already used** | Request a new e-mail; e-mail scanners that pre-open links can consume one-time tokens |

---

## 8. Run EventDeck on Windows

```powershell
npm run dev
```

(This runs `cross-env NODE_OPTIONS=--max-http-header-size=65536 next dev`. The larger header limit leaves room for Supabase session cookies.)

**Success looks like:**

```
▲ Next.js 16.4.0 (Turbopack)
- Local:        http://localhost:3000
- Environments: .env.local
✓ Ready in 1.2s
```

Open <http://localhost:3000> in Chrome or Edge. The first visit to each page compiles it, so it can take a few seconds. Watch the terminal for errors: they are printed there, not only in the browser.

Stop the server with **Ctrl+C** in that terminal (answer `Y` if PowerShell asks *Terminate batch job?*).

Use another port if 3000 is busy:

```powershell
npm run dev -- -p 3001
```

If you change the port, also set `NEXT_PUBLIC_APP_URL=http://localhost:3001` so e-mail links match, and restart.

### Production build locally

```powershell
npm run build
```

```powershell
npm run start
```

`npm run build` must finish with a route table and no errors. `npm run start` serves the built app on <http://localhost:3000>. Stop `npm run dev` first, because both use the `.next` folder.

---

## 9. Test the application

### 9.1 Automated checks (no database needed)

```powershell
npm run lint
```

```powershell
npm run typecheck
```

```powershell
npm run test:unit
```

Or all three: `npm run verify`. Expected: lint `0 errors` (a few warnings are known), type check silent, unit tests all passed.

### 9.2 Manual checklist

Use fictional data or the seeded demo accounts (`admin@`, `organizer@`, `cultural@`, `participant@`, `guest@`, `aditi@`, `applicant@eventdeck.test`, password = `SEED_DEMO_PASSWORD`).

| Area | What to try | Expected |
| --- | --- | --- |
| Home & navigation | Open `/`, use the poster carousel, category chips and search | Events load; search filters results |
| Sign-up | `/signup`: four steps (account, origin, details, review) | Account created as **participant**. SRM students must use an `@srmist.edu.in` address. |
| E-mail confirmation | Click the link in the e-mail (if *Confirm email* is on) | Lands on `/events` signed in, or on `/login` with a clear message |
| Login / logout | `/login`, then the user menu → sign out | Sent to the role's home page; protected pages require sign-in again |
| Password reset | `/forgot-password` → e-mail link → `/reset-password` | New password works; the old one does not |
| Protected pages | Open `/organizer` or `/admin` signed out, then as a participant | `/login?next=…`, then `/forbidden` |
| Booking (free) | Book a free event | Approved immediately; QR tickets under *My tickets* |
| Booking (paid) | Book a paid tier; pay with the simulator or a Razorpay test card | Seats held for 10 minutes; approved and tickets issued once payment is verified |
| Limits | Try to book a fifth ticket for one event | Refused: at most 4 tickets per person |
| Audience rules | Book an "SRM KTR only" event as a guest | Refused with the reason |
| Organizer | Create an event with two tiers, publish, edit, unpublish; add a moderator on the **Team** tab | Changes persist; the moderator sees *Check-in* in their menu |
| Check-in | Organizer → event → **Scanner**; type a ticket number twice | First: checked in. Second: "already checked in" |
| Admin | `/admin`: People, Cancellations, Refunds, Payouts, Exceptions, Reports (CSV), Audit log | Pages load in a few seconds; CSV downloads |
| Mobile layout | Browser dev tools (F12) → device toolbar → a phone size | No horizontal scrolling; menu collapses |

The camera scanner needs a secure origin: `http://localhost` works on the same PC; on a phone, use the HTTPS production site.

### 9.3 Integration and end-to-end tests (needs a test project)

These suites write data, so they refuse to run against the project in `.env.local`. One-time setup:

1. Create a **second** free Supabase project for tests and turn **off** *Confirm email* in it.
2. `Copy-Item .env.test.example .env.test`, then fill in that project's URL, keys and **session pooler** URL.
3. Run each of these:

```powershell
npm run test:db:migrate
```

```powershell
npm run test:db:seed
```

```powershell
npm run test:integration
```

```powershell
npm run test:e2e
```

Playwright starts its own server on port 3100. `tests/env-guard.ts` stops the run if `.env.test` is missing or points at the main project.

---

## 10. Windows troubleshooting

| Symptom | Likely cause | Safe fix |
| --- | --- | --- |
| `'node'`/`'npm'`/`'git' is not recognized` | Not installed, or terminal opened before installing | Install from the official site, then open a **new** terminal |
| `npm.ps1 cannot be loaded … running scripts is disabled` | PowerShell execution policy | Use `npm.cmd …`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Next.js: "Node.js version … is required" | Node older than 20.9 | Install Node.js 24 LTS |
| `'NODE_OPTIONS' is not recognized` / `'ENV_FILE' is not recognized` | Old copy of `package.json` without `cross-env` | Pull the latest code and run `npm ci` |
| `Port 3000 is in use` / `EADDRINUSE` | Another dev server is still running | Close it with Ctrl+C, or find it: `Get-NetTCPConnection -LocalPort 3000 \| Select-Object OwningProcess` then `Stop-Process -Id <id>`; or use `npm run dev -- -p 3001` |
| `DATABASE_URL is not configured` | `.env.local` missing, misnamed (`.env.local.txt`) or in the wrong folder | `Get-ChildItem -Force -Name .env*` in the folder with `package.json` |
| `password authentication failed for user "postgres…"` | Wrong database password, or special characters not URL-encoded | Copy the string again from Supabase → Connect; percent-encode `@ : / ? # %` |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` / timeouts on migrate | The direct-connection host is IPv6-only | Use the **Session pooler** string (port 5432) for `DIRECT_URL` |
| Pages hang or fail only when many queries run (e.g. admin) | postgres.js pipelining through the transaction pooler | Already fixed in `src/db/index.ts` (`max_pipeline: 0`). Make sure your copy includes it. |
| "Invalid API key" / 401 from Supabase | Publishable and secret keys swapped, or from another project | Re-copy both from the same project's API Keys page |
| `permission denied for table …` / empty lists | Expected Row-Level Security: the browser key cannot write and sees only its own rows | Do the action through the app (server). Never disable RLS or grant write access to `anon`/`authenticated`. |
| Poster upload or PDF download fails | `SUPABASE_SECRET_KEY` missing, or the Storage buckets weren't created | Set the key; run `npm run db:migrate` on your own project |
| No confirmation or reset e-mail | SMTP settings, rate limit, spam, or DNS | Follow the table in §7; check Supabase Auth logs and the Brevo transactional log |
| "Email confirmation failed or link has expired" | Token used or expired, or link opened in another browser (`?code=` flow) | Request a new e-mail; consider the token-hash template link (§7) |
| Link opens a Vercel login screen | Link points at a protected preview deployment | Site URL `https://eventdeck.online`; production redeployed |
| A `*.vercel.app` preview URL appears in a production e-mail | Old deployment, or the Site URL is set to a preview | Site URL → production domain; redeploy (current code always uses `https://eventdeck.online` on production) |
| `www.eventdeck.online` shows a certificate error | `www` points at Vercel but is not added to the Vercel project | Vercel → Domains → add `www.eventdeck.online` (redirect to the apex), or remove the `www` DNS record |
| `npm run typecheck` / `npm run build` fails | A real type or compile error | Read the first error's file and line; fix it; don't add `// @ts-ignore` to silence it |
| Browser console shows CORS errors to `*.supabase.co` | Wrong `NEXT_PUBLIC_SUPABASE_URL` (typo or another project) | Fix the URL and restart `npm run dev` |
| Camera does not open on a phone | Camera needs HTTPS | Use the production site, or type the ticket number manually |

---

## 11. Project architecture and developer workflow

```
src\
  proxy.ts            refreshes the Supabase session; sends signed-out users to /login
  app\
    (site)\           public pages: home, /events, /events/[slug], /forbidden
    (auth)\           /login, /signup, /forgot-password, /reset-password
    auth\confirm\     e-mail link landing route
    my\               participant: bookings, booking detail, notifications, profile
    organizer\        organizer dashboard, events (+ bookings, scan, attendance, team, edit, activity), payouts
    moderate\         moderator: assigned events and scanner
    admin\            overview, events, people, cancellations, refunds, payouts, exceptions, reports, audit
    actions\          Server Actions called by forms
    api\              route handlers: checkin, payments, webhooks/razorpay, tickets, reports, cron
  lib\
    domain\           pure rules: eligibility, pricing, transitions, tokens (unit-tested)
    server\           database services: bookings, payments, checkin, events, moderators, payouts …
    validation\       Zod schemas shared by forms and server
    supabase\         browser / server / admin Supabase clients
  db\schema.ts        Drizzle schema   ·   db\index.ts  database connection
  components\         UI components (ui\ = shadcn/ui primitives)
drizzle\              SQL migrations   ·   scripts\  seed and admin scripts
```

**Data flow:** browser → `proxy.ts` (session) → page or Server Action → `requirePageUser`/`requireUser` (role) → `src/lib/server/*` (ownership checks, transactions) → PostgreSQL. Realtime pushes `bookings` and `notifications` changes back to open pages. More detail: [architecture/PROJECT_ARCHITECTURE.md](architecture/PROJECT_ARCHITECTURE.md).

**Make and test a small change**

1. `git checkout -b my-change`
2. Start `npm run dev`, edit a file (for example a heading in `src/app/(site)/page.tsx`) and save. The browser updates automatically.
3. Run `npm run verify` (lint + type check + unit tests).
4. For rule changes in `src/lib/domain`, add a test in `tests/unit` and run `npm run test:unit`.
5. Commit and open a pull request.

**Frequently used commands**

| Command | Purpose |
| --- | --- |
| `npm ci` | Clean install from the lockfile |
| `npm run dev` | Development server on port 3000 |
| `npm run lint` · `npm run typecheck` · `npm run test:unit` · `npm run verify` | Checks |
| `npm run build` · `npm run start` | Production build and local production server |
| `npm run db:migrate` | Apply new SQL migrations (uses `DIRECT_URL`) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` (review the SQL before applying) |
| `npm run db:studio` | Browse the database with Drizzle Studio |
| `npm run db:seed` · `npm run seed:dsa` | Demo data (fresh projects only) |
| `npm run admin:create` | Create or promote an administrator |
| `npm run test:integration` · `npm run test:e2e` | Database and browser tests (test project only) |

Database types are not generated by a separate tool: they come from `src/db/schema.ts` through Drizzle's inferred types, so there is no "regenerate types" step.

---

## 12. Production deployment

Production runs on **Vercel** (project serving `https://eventdeck.online`; `https://eventdeck.vercel.app` redirects there) with the hosted Supabase project. Details: [deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md).

1. **Vercel → Settings → Environment Variables (Production):** every variable in §5.2 except `SEED_DEMO_PASSWORD`, `ADMIN_*` and `DSA_*`; `NEXT_PUBLIC_APP_URL=https://eventdeck.online`; `ALLOW_MOCK_PAYMENTS=false`; a strong `CRON_SECRET`.
2. **Supabase:** Site URL and Redirect URLs as in §6.3; SMTP and templates as in §7.
3. **Razorpay (Test Mode):** webhook `https://eventdeck.online/api/webhooks/razorpay` with `RAZORPAY_WEBHOOK_SECRET`.
4. **Deploy:** push to the production branch, or *Redeploy* in Vercel after changing variables (`NEXT_PUBLIC_*` values are compiled in at build time).
5. **Migrations:** review new files in `drizzle\`, then apply them from a trusted machine with the production `DIRECT_URL` (`npm run db:migrate`) **before** deploying code that needs them. Never reset or drop production tables.
6. **Smoke test:** home page, sign-up with a real inbox (confirmation e-mail arrives from `noreply@eventdeck.online`), sign-in, free booking, paid test booking, PDF download, password reset, `/admin` as an administrator.

`vercel.json` schedules `/api/cron/expire-holds` daily at 03:00 UTC as a safety net; holds also expire whenever bookings are read.

---

## 13. Clean-machine verification

**Procedure for a new Windows PC** (record the result of each step):

1. `node --version` (24.x), `npm --version`, `git --version`
2. `git clone …` and `Set-Location` into the folder
3. `npm ci`: finishes without `ERR!`
4. `Copy-Item .env.example .env.local`, fill it in; `Get-ChildItem -Force -Name .env*` shows `.env.local`
5. `npm run verify`: lint 0 errors, type check clean, unit tests pass
6. `npm run dev`: "Ready"; <http://localhost:3000> shows events
7. Sign in with a test or demo account; open *My tickets*
8. Ctrl+C; `npm run build`, then `npm run start`; check <http://localhost:3000> again

**Assumptions this manual makes**

- Windows 10/11 64-bit with permission to install software for the current user.
- Access to the GitHub repository.
- Supabase values for `.env.local`: either access to the team's project (provided by the owner) or your own free project with `npm run db:migrate` applied.
- Internet access to npmjs.com, github.com, supabase.co (and razorpay.com for paid tests).

**Needs private credentials or dashboard access (not in the repository)**

- Supabase keys, database password, Site URL / Redirect URLs, SMTP settings and e-mail templates.
- Brevo SMTP login and key, sender and domain settings.
- Razorpay Test Mode keys and webhook secret.
- Vercel project settings, environment variables and domains.
- DNS for `eventdeck.online`.
