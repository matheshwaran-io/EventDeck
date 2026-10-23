# Development Setup (clean clone, any OS)

A concise path from a fresh clone to a running app. Windows users: the step-by-step manual with PowerShell commands is [../WINDOWS_SETUP_AND_RUN.md](../WINDOWS_SETUP_AND_RUN.md). Background: [../PROJECT_MAINTENANCE_MANUAL.md](../PROJECT_MAINTENANCE_MANUAL.md).

## 1. Requirements

- Node.js **20.9 or newer** (required by Next.js 16; 24 LTS is what the project is developed with) and npm. Check with `node --version` and `npm --version`.
- Git.
- A Supabase project: the team's (ask the owner for values; do **not** run migrations or seeds against it without agreement) or your own free project.
- No Docker, local PostgreSQL or global packages are needed.

## 2. Get the code and install

```bash
git clone https://github.com/Eventdeck88/EventDeck.git
cd EventDeck
npm ci
```

`npm ci` installs exactly what `package-lock.json` records. Use `npm install <pkg>` only when deliberately changing dependencies.

## 3. Configure

Copy the template and fill it in. Never commit `.env.local`.

```bash
cp .env.example .env.local
```

(Windows PowerShell: `Copy-Item .env.example .env.local`.)

Minimum for the app to start: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`. For paid tickets without Razorpay keys set `ALLOW_MOCK_PAYMENTS=true`. Every variable: [../ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md).

Connection strings come from Supabase → **Connect**. Use the **session pooler** (port 5432) for `DIRECT_URL`. For `DATABASE_URL`, the transaction pooler (6543) is the documented default, but it currently has an open hang issue under parallel queries ([../troubleshooting/TROUBLESHOOTING.md](../troubleshooting/TROUBLESHOOTING.md) §1.2). The session pooler is the workaround that tested clean.

## 4. Database (your own project only)

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` applies `drizzle/0000`–`0008` (tables, constraints, RLS, triggers, storage buckets, realtime). `db:seed` is optional: it creates fictional demo accounts, password = `SEED_DEMO_PASSWORD`, and should only be run on a fresh project. Optional extras: `npm run seed:dsa` (poster events) and `npm run admin:create` (first admin).

## 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Stop with Ctrl+C. Another port: `npm run dev -- -p 3001`, and set `NEXT_PUBLIC_APP_URL` to match.

## 6. Check your work

```bash
npm run verify
npm run build
```

`verify` = lint + type check + unit tests (no database needed). `npm run build` currently fails with a Next.js `SecurityFatalError` until `next` is upgraded to 16.4.2 (see the manual §18). Integration and E2E tests need a separate Supabase test project: [../testing/TESTING.md](../testing/TESTING.md).
