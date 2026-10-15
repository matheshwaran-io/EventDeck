# EventDeck Documentation

Welcome to the EventDeck technical documentation. This directory provides comprehensive guides, architecture specifications, standard operating procedures, and developer documentation for the EventDeck university event management system.

---

## Documentation Index

### 1. Architecture & Design
- **[System Architecture](architecture/PROJECT_ARCHITECTURE.md)**: High-level system design, data flows, security boundaries, status transition engine, and database schema overview.

### 2. Development Guides
- **[Contributing Guidelines](development/CONTRIBUTING.md)**: Contribution workflow, branch conventions, pull request checklist, and code review standards.
- **[Coding Standards](development/CODING_STANDARDS.md)**: Code style, naming conventions, React 19 / Server Components best practices, error handling, and validation patterns.
- **[Windows Setup & Run Manual](WINDOWS_SETUP_AND_RUN.md)**: Complete Windows 10/11 manual — prerequisites, installation, `.env.local`, Supabase and Brevo configuration, running, testing, troubleshooting and deployment.
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)**: Every environment variable the code reads, with purpose, requirement and public/secret classification.

### 3. Deployment & Operations
- **[Deployment Guide](deployment/DEPLOYMENT_GUIDE.md)**: Step-by-step deployment to Vercel, Supabase cloud configuration, custom domain (`eventdeck.online`), Brevo SMTP setup, and production cron triggers.

### 4. Operations & Diagnostics
- **[Troubleshooting Guide](troubleshooting/TROUBLESHOOTING.md)**: Root-cause diagnosis and resolutions for database pooler issues, auth redirects, Razorpay test mode, QR scanning camera permissions, and more.

### 5. Functional Testing Manuals & QA Documentation
- **[Complete Functional Testing Manual](testing/TESTING_MANUAL.md)**: Master step-by-step testing manual for evaluators, testers, and reviewers.
- **[Test Cases Matrix](testing/TEST_CASES.md)**: 84 identifiable test cases with preconditions, steps, expected outcomes, priority, and status.
- **[Role-Based Test Account Guide](testing/TEST_ACCOUNTS.md)**: Comprehensive test account inventory, role boundaries, and safe provisioning workflows.
- **[Razorpay Payment Testing Guide](testing/PAYMENT_TESTING_GUIDE.md)**: Official Razorpay Test Mode setup, Indian test cards, Netbanking simulation, error handling, and webhooks.
- **[QA Test Plan](qa/QA_TEST_PLAN.md)**: Comprehensive quality assurance test plan and scope.
- **[QA Test Cases (Automated)](qa/QA_TEST_CASES.md)**: Core automated test cases covering authentication, bookings, payments, and check-in.
- **[QA Bug Report](qa/QA_BUG_REPORT.md)**: Audit of identified bugs, severity levels, and resolutions.
- **[QA Final Report](qa/QA_FINAL_REPORT.md)**: End-of-cycle testing verification report.
- **[Final Engineering Report](reports/final-report/)**: Comprehensive project final report deliverables and source assets.

---

## Quick Reference

| Resource | Location | Purpose |
| :--- | :--- | :--- |
| **Main Repository README** | `../README.md` | Quickstart, stack summary, and core command reference |
| **Database Migrations** | `../drizzle/` | Drizzle ORM schema migrations |
| **Server Services** | `../src/lib/server/` | Transactional backend business logic |
| **Domain Logic** | `../src/lib/domain/` | Pure business rules and state machines |
| **Client UI Components** | `../src/components/` | Modular React components |
