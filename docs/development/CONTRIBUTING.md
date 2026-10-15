# Contributing to EventDeck

Thank you for contributing to EventDeck. To maintain engineering quality, security, and predictability across the repository, please adhere to the following guidelines.

---

## 1. Development Workflow

1. **Fork or Branch**: Create a descriptive feature branch from `main`:
   ```bash
   git checkout -b feature/event-analytics
   # or
   git checkout -b fix/ticket-qr-regeneration
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup**:
   Ensure `.env.local` contains valid credentials according to `.env.example`.

---

## 2. Verification Checklist Before Submitting Code

Before creating a pull request or pushing changes, run the full validation suite:

```bash
# 1. TypeScript compilation check
npm run typecheck

# 2. ESLint check
npm run lint

# 3. Unit test suite
npm run test:unit

# 4. Production Next.js build
npm run build
```

All 4 commands must exit cleanly with code `0`.

---

## 3. Branch & Commit Standards

- **Branch Naming**:
  - `feature/<short-description>` for new capabilities.
  - `fix/<short-description>` for bug fixes.
  - `refactor/<short-description>` for architectural or structural improvements.
  - `docs/<short-description>` for documentation changes.
- **Commit Messages**:
  - Use conventional imperative commit messages:
    - `feat: add export to CSV for check-in attendance`
    - `fix: prevent duplicate scans under network latency`
    - `docs: update deployment instructions for Brevo SMTP`

---

## 4. Architectural Rules

- **No client-side DB access**: Never import `db` or secret keys into Client Components (`"use client"`).
- **Audit Logging**: Any administrative or state-altering mutation must record an entry in `audit_logs`.
- **Transactional Safety**: Multi-table updates must use `db.transaction(async (tx) => { ... })`.
- **Root Admin Immutability**: Never remove or alter the protections around `eventdeck88@gmail.com`.
