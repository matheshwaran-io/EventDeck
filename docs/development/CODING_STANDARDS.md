# EventDeck Coding Standards & Conventions

This document outlines the coding standards, patterns, and conventions used across the EventDeck codebase.

---

## 1. Naming & File Conventions

| Item | Convention | Example |
| :--- | :--- | :--- |
| **Directory Names** | `kebab-case` | `src/components/organizer/`, `src/lib/server/` |
| **Component Files** | `kebab-case.tsx` | `event-card.tsx`, `ticket-selector.tsx` |
| **Component Functions** | `PascalCase` | `export function EventCard(...)` |
| **Utility / Service Files** | `kebab-case.ts` | `booking-engine.ts`, `payout-service.ts` |
| **Functions & Variables** | `camelCase` | `calculateAvailableCapacity`, `isRootAdmin` |
| **Constants** | `SCREAMING_SNAKE_CASE` | `MAX_TICKETS_PER_PERSON`, `HOLD_MINUTES` |
| **Types & Interfaces** | `PascalCase` | `Profile`, `TicketTier`, `ActionResult` |
| **Zod Schemas** | `camelCaseSchema` | `eventFormSchema`, `loginSchema` |

---

## 2. Directory Structure by Responsibility

```
src/
├── app/                  # Next.js App Router (Pages, Layouts, API Routes, Server Actions)
│   ├── (auth)/           # Authentication pages (login, signup, forgot-password, reset-password)
│   ├── (site)/           # Public landing and event listing pages
│   ├── actions/          # Next.js Server Actions ("use server")
│   ├── admin/            # Administrator console pages
│   ├── api/              # Route Handlers ("GET", "POST", webhooks, cron, reports)
│   ├── moderate/         # Check-in and scanning interface
│   ├── my/               # Participant bookings, profile, notifications
│   ├── organizer/        # Organizer dashboard and event management
│   ├── proxy.ts          # Next.js 16 Session Proxy & Gatekeeper
│   └── globals.css       # Tailwind CSS v4 design tokens and utilities
│
├── components/           # UI Components
│   ├── admin/            # Admin console components
│   ├── auth/             # Authentication forms and cards
│   ├── bookings/         # Booking wizard and ticket view components
│   ├── common/           # Generic shared UI (empty-state, status-badge, page-header)
│   ├── events/           # Event discovery, poster art, rail, filter components
│   ├── layout/           # App-wide layout components (header, footer, nav-links)
│   ├── moderators/       # Moderator management dialogs
│   ├── organizer/        # Organizer forms, tables, and metrics
│   ├── profile/          # User profile forms
│   └── ui/               # Core design system primitives (Button, Card, Dialog, Input, etc.)
│
├── db/                   # Database Layer
│   ├── index.ts          # PostgreSQL connection pooler (Drizzle instance)
│   └── schema.ts         # Drizzle schema definitions, relations, and enums
│
└── lib/                  # Utilities, Domain & Server Services
    ├── auth.ts           # Authentication session helpers & guards
    ├── constants.ts      # Application-wide constants & enums
    ├── domain/           # Pure business logic (pricing, eligibility, tokens, transitions)
    ├── format.ts         # Formatting utilities (currency, dates, relative time)
    ├── razorpay.ts       # Razorpay client & signature verification
    ├── server/           # Server-only transactional business logic
    ├── supabase/         # Supabase client factories (client, server, admin)
    └── validation/       # Zod validation schemas
```

---

## 3. Module Boundaries & Execution Contexts

### 3.1. Server vs. Client Components
- By default, all components in `src/app` and `src/components` are **React Server Components (RSC)**.
- Mark interactive components with `"use client"` at the very top of the file only when:
  - Using React state (`useState`, `useReducer`).
  - Using React effects or lifecycle hooks (`useEffect`, `useTransition`).
  - Listening to DOM events (`onClick`, `onChange`).
  - Accessing browser APIs (e.g., `camera`, `localStorage`).

### 3.2. Server Actions ("use server")
- Place server actions in `src/app/actions/`.
- Every server action must:
  1. Authenticate the caller using `requireUser()`.
  2. Validate payload data using a Zod schema.
  3. Call the appropriate transactional service in `src/lib/server/`.
  4. Return a structured `ActionResult<T>` response (`{ ok: true, data }` or `{ ok: false, error }`).

---

## 4. Import Path Standard

Always use the TypeScript path alias `@/...` rather than deep relative imports:

```ts
// Preferred:
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// Avoid:
import { db } from "../../../db";
import { requireUser } from "../../lib/auth";
```

---

## 5. Input Validation & Error Handling

- **Validation**: Never trust client input. Validate all form inputs and server action parameters using Zod schemas located in `src/lib/validation/`.
- **Domain Errors**: Throw `DomainError(message, code)` for domain-specific failures.
- **Action Results**: Use the helper `toActionError(err)` in server actions to convert thrown errors into structured client responses without leaking internal server stack traces.
