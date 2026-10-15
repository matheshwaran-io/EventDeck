# -*- coding: utf-8 -*-
"""Revised EventDeck report content (15 October 2026).

Built on report_content.py, which is left unchanged: every revision below is an explicit rule,
and building fails if a rule no longer matches. The kinds of change are:
  1. originality rewrites of sentences that duplicated the team's Electify report;
  2. technical corrections for code changed after the original report (root administrator,
     migration 0008, fixed defects, new test evidence);
  3. reference renumbering (IEEE order of first citation) and edition-specific URLs.
See docs/reports/originality/CHANGE_SUMMARY.md for the audit trail.
"""
import copy
import os
import re

import report_content as O

HERE = os.path.dirname(os.path.abspath(__file__))
TITLE = O.TITLE  # official title, unchanged
ABSTRACT = O.ABSTRACT

# ---------------------------------------------------------------- acknowledgement (front matter)
# Same people and roles as before, new wording (the old text was identical to the Electify report).
ACKNOWLEDGEMENT = [
    "Our first thanks go to the Almighty, and to our parents, whose encouragement has carried us through our studies and through this project.",
    "We express our gratitude to **Dr. T. R. Paarivendhar,** Chancellor, SRM Institute of Science and Technology, for the institution's facilities and for the academic environment in which EventDeck was developed.",
    "We are thankful to **Dr. A. Duraisamy,** Dean, Faculty of Science and Humanities, and to **Dr. S. Albert Antony Raj,** Deputy Dean, Faculty of Science and Humanities, for their encouragement and support.",
    "We thank **Dr. P. J. Arul Leena Rose,** Professor and Head, Department of Computer Applications, for supporting our project work and the reviews held during the semester.",
    "We are indebted to our project guide, **Dr. V. Nisha,** Assistant Professor, Department of Computer Applications, whose guidance, suggestions and patience helped us at every stage of EventDeck.",
    "We also thank the faculty members of the Department of Computer Applications for their remarks during the project reviews, and our classmates and friends for their help and encouragement while the system was being built and tested.",
]

# ---------------------------------------------------------------- new test evidence (15 Oct 2026, 15:26 IST)
RUN_LOG = os.path.join(HERE, "unit-2026-10-15-1526.txt")
UNIT = []
with open(RUN_LOG, encoding="utf-8") as f:
    for line in f:
        m = re.match(r"\s*✓ \|unit\| tests/unit/(\S+)\.test\.ts > (.+?)(?: \d+ms)?$", line)
        if m:
            parts = m.group(2).split(" > ")
            UNIT.append((m.group(1), " › ".join(parts[:-1]), parts[-1]))
assert len(UNIT) == 63, len(UNIT)
UNIT_BY_FILE = {}
for fname, _, _ in UNIT:
    UNIT_BY_FILE[fname] = UNIT_BY_FILE.get(fname, 0) + 1

# ---------------------------------------------------------------- whole-paragraph rewrites (matched by prefix)
P = {
    # 1.3.1 / 1.3.2
    "The main objective of the project is to build a working event ticketing system":
        "EventDeck was built to give a multi-campus university one dependable system for selling and checking event tickets, and to "
        "show through testing that its core rules hold up under concurrent and hostile use. Six objectives guided the work:",
    "Payments use Razorpay in Test Mode only;":
        "Every payment runs in Razorpay Test Mode: live keys are rejected, so this version neither collects nor refunds real money. "
        "Organizer payouts are bookkeeping entries; an administrator records the bank transfer reference, and the transfer itself is "
        "made outside EventDeck. Waiting lists, invite-only allow-lists, numbered seat maps and native mobile apps were not attempted "
        "in this version.",
    # 2.2-2.6
    "Berenson et al. [6] showed":
        "Berenson et al. [6] demonstrated that the isolation levels defined by the SQL standard still admit subtle anomalies, for "
        "instance two transactions that each read a value and then overwrite the other's update, and Kleppmann [7] shows how such races "
        "surface in present-day web services. Rather than detecting them in application memory, EventDeck relies on three PostgreSQL "
        "facilities: row locks taken with SELECT … FOR UPDATE and FOR SHARE [8], the documented isolation behaviour [9], and "
        "INSERT … ON CONFLICT [10], through which a unique index settles which of several simultaneous inserts survives.",
    "Saltzer and Schroeder's principles for the protection of information":
        "Of the design principles set out by Saltzer and Schroeder [11], three matter most here: grant the least privilege needed, "
        "check every access, and deny by default. Role-based access control, formalised by Ferraiolo and Kuhn [12] and extended by "
        "Sandhu et al. [13], attaches permissions to roles instead of individual accounts. EventDeck follows this model with three "
        "platform roles, yet a role alone cannot express its rules: every organizer holds the same role but may manage only the events "
        "they own, and a moderator may scan tickets for a single event. Access decisions therefore combine the caller's role with the "
        "caller's relationship to the specific record.",
    "The project uses Next.js [24]":
        "EventDeck is written with Next.js [24] on top of React [25]. Pages are rendered on the server, and forms call server-side "
        "functions (Server Actions) directly, so most interactions need no separate REST layer. The Drizzle ORM [26] provides typed SQL "
        "and versioned migrations. Supabase hosts the PostgreSQL database and adds authentication [27], realtime change feeds [28] and "
        "connection pooling [29]. Vitest [30] runs the unit and integration suites, Playwright [31] drives the browser tests, and the "
        "W3C accessibility guidelines [32] served as the checklist for interface work.",
    "The sources reviewed above address the parts of the problem separately.":
        "Each body of work above addresses one piece of the problem in isolation. Transaction-processing research [1], [5]–[7] shows how "
        "a scarce resource can be reserved without double allocation; access-control research [11]–[13] shows how authority can be "
        "divided between kinds of users; and payment and token standards [19]–[21] show how a pass can be made unforgeable. Off-the-shelf "
        "form builders and ticketing tools, by contrast, assume one organizer and one audience, with no notion of several campuses, "
        "partner colleges or door staff appointed for a single event.",
    "For a university that wants to run its events on its own system":
        "A university running its own events needs all of these ideas in one place: seats reserved inside database transactions, "
        "audience rules checked against verified profiles, payments confirmed by the provider rather than by a screenshot, tickets that "
        "count as valid only when every condition holds, and admission that stays correct when two moderators scan the same code. "
        "Building that combination, and testing it, is the contribution of EventDeck.",
    # 3.2 / 3.3
    "The proposed system follows the overall flow shown below.":
        "The end-to-end flow of the proposed system is summarised below; Chapters 4 to 7 describe each stage in detail.",
    "The functional requirements identified for the system are listed in Table 3.2.":
        "Table 3.2 lists the functional requirements. All fifteen are implemented in the current code, and later chapters refer to them "
        "by their FR numbers.",
    # 4.1-4.9
    "EventDeck is a full-stack web application organised in four tiers":
        "Figure 4.1 arranges EventDeck into four tiers. All four kinds of user (participants, organizers, moderators and administrators) "
        "work in the same web application, on a laptop or a phone. Each request passes first through src/proxy.ts, which renews the "
        "Supabase session cookie and turns signed-out visitors away from protected areas. Behind it, React Server Components render "
        "pages, Server Actions process form submissions, and route handlers serve the scanner, payment callbacks, webhooks, ticket PDFs, "
        "CSV reports and the scheduled hold-expiry job.",
    "The business rules are kept in a small set of modules under src/lib.":
        "The rules themselves live in a handful of modules under src/lib: domain/eligibility.ts decides who may book, domain/pricing.ts "
        "computes prices, domain/transitions.ts defines the booking state machine, server/bookings.ts reserves seats and manages holds, "
        "server/payments.ts confirms payments, server/checkin.ts handles scans and server/moderators.ts decides who may scan. Pages, "
        "actions and route handlers only call these modules; none of them edits seat counts or statuses on its own.",
    "The data tier is a Supabase PostgreSQL database accessed through the Drizzle ORM":
        "Data is held in Supabase PostgreSQL and reached through Drizzle over the postgres.js driver. The same Supabase project stores "
        "posters and cached ticket PDFs and publishes realtime changes, so an open booking page and the notification bell refresh as soon "
        "as the underlying rows change. Only the server talks to Razorpay, and Razorpay's webhooks arrive at a dedicated route that "
        "checks their signature before acting on them.",
    "The technologies used in the project are listed in Table 4.1.":
        "Table 4.1 lists the technologies; each version is taken from package.json.",
    "Figure 4.2 presents the level-1 data flow diagram.":
        "The level-1 data flow diagram in Figure 4.2 shows five external entities exchanging data with five processes. Participants sign "
        "up and request tickets; organizers publish events and receive bookings and attendance; Razorpay exchanges orders and payment "
        "events with the booking process; moderators feed QR scans to the check-in process; and administrators decide cancellations, "
        "refunds and payouts. The four data stores group the tables described in Section 4.4.",
    "The database schema is defined in src/db/schema.ts.":
        "src/db/schema.ts declares the schema, and Figure 4.3 draws its main tables and links. Every Supabase Auth user has a profile row "
        "holding the role, institution details and an active flag. An event is owned by one organizer and divided into ticket tiers, each "
        "tracking its capacity and how many seats are currently allocated. A booking ties one participant to one event and is split into "
        "booking items, one per tier; every confirmed seat becomes a ticket, and a ticket can be checked in at most once.",
    "The server-side logic that responds to users is divided into Server Action modules":
        "Code that answers a user request is split between Server Action files in src/app/actions and route handlers in src/app/api "
        "(Table 4.3). Each one identifies the caller, validates the input with Zod, and then hands the work to the domain and service "
        "modules of Section 4.1.",
    "Accounts are managed by Supabase Auth with e-mail and password.":
        "Supabase Auth manages accounts with e-mail and password. A password must be 8 to 72 characters long and contain at least one "
        "letter and one number, and Supabase stores only its hash. After sign-in the session lives in HTTP-only cookies handled by "
        "@supabase/ssr; the edge proxy renews them when required, and on every server request getCurrentUser confirms the session with "
        "Supabase Auth before loading the profile. An account that an administrator has deactivated is treated as signed out from its "
        "next request.",
    "The sign-up form never accepts a role.":
        "The sign-up form never accepts a role. A database trigger creates each new account as a participant and classifies its "
        "institution profile, accepting an SRM student classification only for an SRM e-mail domain (srmist.edu.in or srmuniv.ac.in); "
        "calling the authentication service directly therefore cannot make someone an SRM student. The same trigger gives the "
        "administrator role to one fixed address, the root administrator (eventdeck88@gmail.com, migration 0008), whose account database "
        "triggers protect from demotion, deactivation, deletion and e-mail change. Because that grant happens at sign-up, it is safe only "
        "while e-mail confirmation stays enabled in Supabase. Confirmation and password-reset e-mails are sent by Supabase Auth through a "
        "custom SMTP relay (Brevo) configured in the Supabase dashboard. The links carry a one-time token exchanged at /auth/confirm, "
        "which redirects only to same-site paths, and a reset request receives the same response whether or not the address has an account.",
    "The interface was designed around the tasks each role performs most often.":
        "Each role's screens were shaped around what that role does most. Participants get a consumer-style ticketing experience: a "
        "home page led by a poster carousel and scrolling rails of events, a searchable event list, and event pages with a full poster "
        "and a ticket selector. Organizers and administrators share a dashboard frame with a sidebar, summary cards, per-event tabs and "
        "exportable tables. Figure 4.5 shows the sign-in page.",
    "The design separates concerns along clear lines.":
        "Responsibilities are divided cleanly. The proxy looks after sessions; pages and actions check identity and input; domain modules "
        "make the decisions; and the database enforces the final guarantees through constraints, unique keys and row-level security. "
        "Because price, eligibility, seat availability, payment success and ticket validity are each decided in one server-side place, a "
        "request receives the same treatment whether it comes from the interface, from a retried submission or from a direct API call.",
    # 5.7 / 6
    "Setting up an event in EventDeck therefore involves":
        "In practice an organizer needs only a short sequence to run an event: obtain organizer access, create the event with its tiers, "
        "windows and audience rules, add a poster, publish it and appoint moderators. Every later booking and scan is then governed "
        "automatically by the rules described in Chapter 6.",
    "This chapter explains how a booking is processed,":
        "This chapter follows a booking from request to admission: how it is processed, how seats are counted, how payments are "
        "confirmed, how tickets are scanned, and how the data stays consistent under simultaneous requests.",
    "Before a booking is created, the function checkEligibility":
        "Whether a participant may book is settled by checkEligibility in src/lib/domain/eligibility.ts before any booking row exists. "
        "The function compares the event's stored rules with the participant's stored profile and ignores any institution, campus, "
        "category or user identifier sent with the request. Table 6.1 lists its conditions; when one fails, the participant is told "
        "which, for example that the event is open only to SRM Kattankulathur.",
    "Figure 6.1 shows the steps of createBooking":
        "createBooking in src/lib/server/bookings.ts proceeds as drawn in Figure 6.1. Two inexpensive checks come first and take no "
        "locks: a repeated submission carrying the same idempotency key returns the booking already created, and holds on the event "
        "older than ten minutes are released. Everything after that runs inside a single database transaction.",
    "Seats are taken and returned only through two functions":
        "Only two functions ever change a tier's seat count, reserveInventory and releaseInventory, and both run inside the same "
        "transaction as the status change they belong to. For each tier, reserveInventory issues one conditional statement: UPDATE "
        "ticket_tiers SET allocated = allocated + n WHERE id = … AND allocated + n <= capacity. If no row is updated, there are not enough "
        "seats and the booking fails. Because checking and incrementing happen in one statement, two simultaneous buyers can never both "
        "win the last seat, and tiers are always updated in the same sorted order so that two multi-tier bookings cannot deadlock.",
    # 7
    "The system was developed and tested in the environment summarised in Table 7.1.":
        "Table 7.1 summarises the machine and tools used for development and testing.",
    "The repository follows the conventions of the Next.js App Router.":
        "EventDeck follows the Next.js App Router layout. Its source comprises 166 TypeScript files totalling roughly 16,900 lines "
        "(counted on 15 October 2026); Table 7.2 explains the main folders.",
    "The schema is declared in TypeScript with Drizzle in src/db/schema.ts":
        "Drizzle declarations in src/db/schema.ts define the tables, and drizzle-kit turns schema changes into SQL migration files. What "
        "Drizzle cannot express is written directly in SQL: row-level security policies, the trigger that provisions profiles, the "
        "realtime publication, the storage buckets and the root-administrator protections. The nine migration files in Table 7.3 are "
        "applied in order by drizzle-kit migrate, which records each one. On the hosted project drizzle-kit has recorded the first "
        "eight; 0008 was applied by hand and its triggers are present. Because 0008 is written to be re-runnable, the next migrate run can "
        "record it safely.",
    "Sign-in, sign-up and password management are implemented in src/app/actions/auth.ts":
        "src/app/actions/auth.ts implements sign-in, sign-up and password handling with the server-side Supabase client from "
        "src/lib/supabase/server.ts. A successful sign-in leads to the role's home page (the event list for participants, the dashboard "
        "for organizers, the administration overview for administrators) unless a next path was requested and passes safeRedirectPath, "
        "which allows only same-site paths. Administrator rights come from two sources only: the npm run admin:create script, which "
        "reads the address and password from environment variables or generates a strong password, and the fixed root-administrator "
        "address in src/lib/constants.ts. Table 7.4 summarises the parameters.",
    "The application is configured through environment variables, listed in Table 7.5.":
        "Settings come from the environment variables in Table 7.5. Developers keep them in .env.local and production keeps them in the "
        "hosting provider's settings; the repository carries only .env.example templates with placeholder values, and no secret appears "
        "in this report. The npm scripts set variables through cross-env, so they run unchanged in Windows PowerShell and cmd.exe as "
        "well as on macOS and Linux (docs/WINDOWS_SETUP_AND_RUN.md).",
    # 8
    "Testing combined three activities.":
        "Three kinds of evidence were gathered. The first is automated tests at three levels: unit tests of the pure rules with no "
        "database; integration tests that call the real services against PostgreSQL with authentication and storage; and Playwright tests "
        "that operate the application in a browser as each kind of user. The second is static analysis with the TypeScript compiler and "
        "ESLint. The third is a page-by-page walkthrough using fictional demonstration data, which also produced the screenshots in this "
        "report.",
    "The test run reported in this chapter was carried out":
        "Table 8.1 records the environment of the run reported here. On 15 October 2026 at 15:26 IST the unit tests, the type check, the "
        "linter and the production build were executed again on the current commit. The integration and end-to-end suites were not run, "
        "because they need a dedicated Supabase test project that does not exist yet; Section 8.8 reports them separately.",
    "The complete list of unit test names and their results":
        "Appendix 11.3 lists every unit test with its result; the groups that matter most are discussed below.",
    "Table 8.3 lists representative functional test cases":
        "Table 8.3 picks representative functional cases from the unit suite run for this report, quoting each test by its name in the code.",
    "Access-control tests act as different users":
        "In the access-control tests the suite signs in as different users and attempts actions each should be refused, including "
        "requests that substitute someone else's identifiers and direct calls to the Supabase database API. Table 8.5 summarises them; "
        "rows marked historical come from the 14 October 2026 run.",
    "The TypeScript compiler (tsc --noEmit)":
        "In the 15 October 15:26 IST run, tsc --noEmit finished with exit code 0 and no errors, and ESLint reported 0 errors and 3 warnings "
        "(informational React Compiler notes about React Hook Form's watch() function). The production build also succeeded and generated "
        "46 routes. The logs are kept in docs/reports/final-report/working-notes.",
    "For the walkthrough, every participant":
        "In the walkthrough, every participant, organizer and administrator page was opened with the fictional demonstration accounts and "
        "captured by a headless Chromium browser at 1366 × 860 pixels. It was an exploratory review rather than a scripted test with "
        "acceptance criteria, and it produced the evidence in Table 8.6 and the observations in Table 8.7.",
    "Observation OBS-1 was found while capturing the screenshots":
        "OBS-1 surfaced while the screenshots for this report were being captured: through Supabase's transaction-mode pooler, every "
        "administrator page stalled for more than ninety seconds, while organizer and participant pages were unaffected. A direct "
        "comparison isolated the cause. With postgres.js's default query pipelining, 91 of 200 concurrent test queries timed out; with "
        "pipelining disabled, all 200 completed in about 1.9 seconds per round. Setting max_pipeline: 0 in src/db/index.ts fixed the "
        "application, and every administrator page then loaded in 1.2 to 2.1 seconds through the same pooler. The administrator "
        "screenshots in this report were captured before the fix, through the session-mode pooler.",
    "The evidence presented in this chapter shows":
        "The evidence in this chapter shows the rules behaving correctly in the cases exercised, but its reach is limited. Above all, the "
        "integration and end-to-end suites, which hold the concurrency and access-control tests, last ran on 14 October 2026 against a "
        "local stack that has since been removed. They must be re-run on a dedicated Supabase test project before their results can be "
        "treated as current. Table 8.8 lists what was not executed.",
    "Within these limits, the results support":
        "Taken together, and within those limits, the evidence supports the central claims of the design: every tier in the demonstration "
        "database had consistent seat counts, the domain rules for prices, limits, eligibility, token formats and signatures passed all "
        "their tests, and the concurrency and access-control tests passed when last executed.",
    # 9
    "This project set out to build an event ticketing system":
        "EventDeck's goal was a ticketing system for a multi-campus university that cannot oversell an event, judges eligibility from "
        "trusted data, trusts only provider-confirmed payments and admits each ticket exactly once. The implementation achieves this by "
        "placing every seat change in a transaction with a conditional update, evaluating eligibility and limits on the server from stored "
        "profiles, accepting Razorpay payments only after their signatures are verified, and leaving it to a unique constraint to decide "
        "which scan of a ticket counts.",
    "Around this core, the system provides":
        "Built around that core are the everyday tools of event administration: a four-step sign-up that understands SRM campuses and "
        "partner colleges, organizer applications, an event form with tiers, windows and audience rules, poster-led discovery, "
        "event-scoped moderators at the door, cancellations with refunds, payouts, notifications, an audit log and CSV reports.",
    "The work also showed the value of testing":
        "The project also showed why testing against a real database, and walking through the interface, matter. Quality assurance "
        "uncovered two serious defects that let users claim SRM membership they did not hold; both were fixed and covered by regression "
        "tests. Preparing this report exposed a connection-pooling fault on the administrator pages and an open redirect in the sign-in "
        "flow, neither of which unit tests could reveal, and both have since been fixed. The lesson is that an event system's rules must "
        "live, and be tested, on the server and in the database.",
    "This appendix reproduces the parts of the source code":
        "Three short extracts from the repository follow, chosen because they carry the rules discussed in Chapter 6: seat reservation, "
        "the audience check and single admission. Long statements have been wrapped or shortened to fit the page without altering their logic.",
    "The problem addressed by this project can therefore be stated as follows":
        "Stated precisely, the problem is to design and build a university event ticketing system that never issues more tickets than an "
        "event has seats, applies audience and per-person limits on the server from trusted profile data, confirms payments with the "
        "payment provider instead of from screenshots, admits each ticket exactly once even when several moderators scan it at the same "
        "moment, and keeps a complete, auditable record of bookings, cancellations, refunds and payouts.",
    "Web technology now makes it practical for a university":
        "Current web technology lets a university move this whole process onto a system of its own instead of scattering it across poster "
        "images, form links, payment screenshots and printed lists. EventDeck brings every stage of an event's life (publication, "
        "registration, payment, ticket issue, check-in and settlement) into one application, in which the server and the database enforce "
        "the rules rather than the people operating it.",
    "The following screenshots show further pages captured during the walkthrough":
        "Four further screens from the walkthrough are reproduced below; all of them show fictional demonstration data.",
    "Table 11.1 lists every automated test":
        "Table 11.1 lists every unit test in the reported run (15 October 2026, 15:26 IST, commit 745e194, command "
        "npx vitest run --project unit), grouped by file. All 63 tests passed.",
}

# ---------------------------------------------------------------- substring substitutions (paragraphs, list items, table cells)
SUBS = [
    # 3.1 limitation bullet (identical opening to the Electify report)
    ("Seat limits are not checked when a form is submitted, so more people can register than an event can hold.",
     "Nothing stops a registration form from accepting more entries than the hall has seats."),
    # Table 3.1, administrator row
    ("Administrator accounts are created only by a command-line script.",
     "Administrator rights cannot be requested through the website: they come from a command-line script or from the fixed "
     "root-administrator address, which database triggers protect from demotion, deactivation and deletion."),
    # 4.3 caption
    ("Figure 4.3 Entity-Relationship Diagram of the Principal Tables", "Figure 4.3 Entity-Relationship Diagram of EventDeck's Core Tables"),
    # 7.9 deployment paragraph
    ("The Supabase project must have the eight migrations applied", "The Supabase project must have all nine migrations applied"),
    # 8.3
    ("All 59 unit tests in six files passed in 988 milliseconds.", "All 63 unit tests in six files passed in about one second."),
    # Table 7.4
    ("Command-line script only", "Command-line script, or the fixed root-administrator e-mail (protected by migration 0008)"),
    # 9.2 future work
    ("Resolve the recorded observations – reduce parallel queries on the administrator pages or adjust the pooler connection, stop "
     "development logs from printing form values, and remove the leftover test events from the hosted project.",
     "Clear the remaining observations – remove the leftover test events from the hosted project (OBS-3) and paginate the attendance "
     "list for very large events (OBS-4)."),
    ("Load and acceptance testing – measure behaviour with realistic numbers of simultaneous buyers and pilot the system with real organizers.",
     "Capacity and user trials – observe the system under realistic surges of buyers, and pilot it with real organizers to gather feedback."),
]


def _tables():
    """Replacement table blocks, keyed by caption prefix."""
    t = {}
    t["Table 7.1 Development and Test Environment"] = None  # unchanged
    t["Table 8.1 Test Environment for the Reported Run"] = ("table", "Table 8.1 Test Environment for the Reported Run", ["Item", "Details"], [
        ["Date and time", "15 October 2026, 15:26 IST"],
        ["Code version", "Commit 745e194 on branch main (clean working tree)"],
        ["Machine", "Apple M4, macOS 26.6.2"],
        ["Runtime", "Node.js 24.16.0, npm 11.13.0"],
        ["Test runner", "Vitest 5.0 (unit project); Playwright 1.64 configured but not run"],
        ["Database", "None for unit tests; walkthrough on the hosted Supabase project with fictional data"],
        ["Commands", "npx vitest run --project unit · npm run typecheck · npm run lint · npm run build"],
    ], [2, 7])
    rows = [[str(i + 1), "Unit", f"tests/unit/{f}.test.ts", str(n), f"{n} passed, 0 failed"] for i, (f, n) in enumerate(UNIT_BY_FILE.items())]
    integ = [("api-security.test.ts", 4), ("auth-authorization.test.ts", 14), ("booking-engine.test.ts", 17), ("eligibility-bypass.test.ts", 5),
             ("moderators.test.ts", 10), ("storage.test.ts", 2), ("webhook-route.test.ts", 1)]
    rows += [[str(len(rows) + 1 + i), "Integration", f"tests/integration/{f}", str(n), "Not run (no test project)"] for i, (f, n) in enumerate(integ)]
    rows += [[str(len(rows) + 1), "End-to-end", "e2e/*.spec.ts (11 files)", "24", "Not run (no test project)"],
             ["", "Total executed", "", str(len(UNIT)), f"{len(UNIT)} passed, 0 failed"]]
    t["Table 8.2 Automated Test Suites and Results"] = ("table", "Table 8.2 Automated Test Suites and Results",
                                                         ["No.", "Suite", "File", "Tests", "Result"], rows, [0.7, 1.6, 4.2, 0.9, 2.6], False)
    t["Table 11.1 Complete List of Automated Tests and Results"] = ("table", "Table 11.1 Unit Test Results by File, 15 October 2026 Run",
                                                                    ["No.", "Suite", "Test", "Result"],
                                                                    [[str(i + 1), f, (g + " › " if g else "") + n, "Passed"] for i, (f, g, n) in enumerate(UNIT)],
                                                                    [0.7, 1.9, 5.4, 1], False)
    return {k: v for k, v in t.items() if v}


ROW_EDITS = {
    # Table 7.3: add migration 0008
    "Table 7.3 Database Migrations": {"append": [
        ["0008_root_admin_protection.sql", "Grants the root-administrator role to one fixed address and adds triggers that block deleting, "
                                           "demoting, deactivating or re-addressing that account (applied manually on the hosted project)."]]},
    # Table 7.4: redirect rule
    "Table 7.4 Authentication Parameters": {"append": [["Redirect after sign-in or e-mail link", "Same-site paths only (safeRedirectPath)"]]},
    # Table 6.3: root-admin triggers
    "Table 6.3 Principal Integrity Constraints": {"append": [
        ["protect_root_admin, protect_auth_root_admin (triggers)", "The root-administrator account cannot be deleted, demoted, deactivated or given another e-mail."]]},
    # Table 8.7: update statuses, add defects found while preparing the report
    "Table 8.7 Defects and Observations": {
        "weights": [1.1, 3.0, 3.3, 1.6],
        "replace": {
            "OBS-1": ["OBS-1", "Administrator pages hung for more than 90 s on the hosted database",
                      "postgres.js pipelined extra queries onto busy connections through the transaction pooler. Fix: max_pipeline set to 0; pages now load in 1.2–2.1 s",
                      "Fixed 15 Oct 2026"],
            "OBS-2": ["OBS-2", "Development server log printed sign-in form values, including passwords",
                      "Development-mode logging of Server Action arguments. Fix: Server Function logging disabled in next.config.ts", "Fixed 15 Oct 2026"],
        },
        "append": [
            ["QA-010", "Sign-in and e-mail-link redirects accepted paths such as /\\host, which browsers treat as another site (open redirect)",
             "The next parameter was checked only for a leading slash. Fix: a shared safeRedirectPath check with unit tests", "Fixed 15 Oct 2026"],
            ["QA-011", "Demonstration seed script aborted on a fresh project",
             "It approved bookings that are now approved automatically. Fix: the redundant approvals were removed", "Fixed 15 Oct 2026; not re-run on a fresh project"],
        ]},
    # Table 8.8: note the updated, unexecuted e2e spec
    "Table 8.8 Testing Not Executed": {"cell_subs": [
        ("Same requirement; passed on 14 Oct on the earlier stack",
         "Same requirement; passed on 14 Oct on the earlier stack. The paid-booking spec was updated on 15 Oct to the automatic-approval flow and has not run since")]},
}

# ---------------------------------------------------------------- references: edition-specific URLs, then IEEE renumbering
REF_SUBS = [
    ("“OWASP Top 10:2021.” [Online]. Available: https://owasp.org/Top10/ (accessed Oct. 15, 2026).",
     "“OWASP Top 10:2021.” [Online]. Available: https://owasp.org/Top10/2021/ (accessed Oct. 15, 2026)."),
    ("“Application Security Verification Standard 4.0.3,” 2021. [Online]. Available: https://owasp.org/www-project-application-security-verification-standard/ (accessed Oct. 15, 2026).",
     "*Application Security Verification Standard 4.0.3*, Oct. 2021. [Online]. Available: https://github.com/OWASP/ASVS/tree/v4.0.3 (accessed Oct. 15, 2026)."),
    ("Gaithersburg, MD, USA, NIST SP 800-63B, 2017.", "Gaithersburg, MD, USA, NIST SP 800-63B, Jun. 2017, doi: 10.6028/NIST.SP.800-63b."),
    ("Internet Engineering Task Force, RFC 7519, 2015.", "Internet Engineering Task Force, RFC 7519, May 2015. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7519"),
    ("Internet Engineering Task Force, RFC 4086, 2005.", "Internet Engineering Task Force, RFC 4086, Jun. 2005. [Online]. Available: https://www.rfc-editor.org/rfc/rfc4086"),
    ("Internet-Draft draft-ietf-httpapi-idempotency-key-header (work in progress).",
     "Internet-Draft draft-ietf-httpapi-idempotency-key-header (work in progress). [Online]. Available: "
     "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ (accessed Oct. 15, 2026)."),
]

_used = {k: 0 for k in list(P) + [s[0] for s in SUBS] + [s[0] for s in REF_SUBS]}


def _sub(text):
    for old, new in SUBS:
        if old in text:
            _used[old] += 1
            text = text.replace(old, new)
    return text


def _para(text):
    for prefix, new in P.items():
        if text.startswith(prefix):
            _used[prefix] += 1
            return new
    return _sub(text)


BODY = []
tables = _tables()
for block in copy.deepcopy(O.BODY):
    kind = block[0]
    if kind == "p":
        BODY.append(("p", _para(block[1])))
    elif kind in ("num", "bul"):
        BODY.append((kind, [_sub(x) for x in block[1]]))
    elif kind == "fig":
        BODY.append((block[0], block[1], _sub(block[2]), *block[3:]))
    elif kind == "table":
        cap = block[1]
        key = next((k for k in tables if cap.startswith(k)), None)
        if key:
            BODY.append(tables.pop(key))
            continue
        rows = [[_sub(c) for c in r] for r in block[3]]
        edit = next((v for k, v in ROW_EDITS.items() if cap.startswith(k)), None)
        if edit:
            for old, new in edit.get("cell_subs", []):
                hit = False
                for r in rows:
                    for j, c in enumerate(r):
                        if old in c:
                            r[j] = c.replace(old, new)
                            hit = True
                assert hit, old
            for rid, newrow in edit.get("replace", {}).items():
                idx = [i for i, r in enumerate(rows) if r[0] == rid]
                assert idx, rid
                rows[idx[0]] = newrow
            rows += edit.get("append", [])
            edit["_done"] = True
        rest = list(block[4:])
        if edit and edit.get("weights"):
            rest[0] = edit["weights"]
        BODY.append((kind, block[1], block[2], rows, *rest))
    elif kind == "refs":
        refs = []
        for r in block[1]:
            for old, new in REF_SUBS:
                if old in r:
                    _used[old] += 1
                    r = r.replace(old, new)
            refs.append(r)
        BODY.append(("refs", refs))
    else:
        BODY.append(block)

assert not tables, f"replacement tables not placed: {list(tables)}"
assert all(v.get("_done") for v in ROW_EDITS.values()), [k for k, v in ROW_EDITS.items() if not v.get("_done")]
unused = [k[:70] for k, n in _used.items() if n == 0]
assert not unused, f"revision rules that matched nothing: {unused}"

# ---- IEEE: number references in order of first citation in the body text
_body_text = " ".join(b[1] for b in BODY if b[0] == "p")
_order = []
for m in re.finditer(r"\[(\d+)\]", _body_text):
    n = int(m.group(1))
    if n not in _order:
        _order.append(n)
_ref_idx = next(i for i, b in enumerate(BODY) if b[0] == "refs")
_old_refs = BODY[_ref_idx][1]
assert sorted(_order) == list(range(1, len(_old_refs) + 1)), "every reference must be cited"
REMAP = {old: new for new, old in enumerate(_order, start=1)}


def _renumber(text):
    return re.sub(r"\[(\d+)\]", lambda m: f"[{REMAP[int(m.group(1))]}]", text)


BODY = [("p", _renumber(b[1])) if b[0] == "p" else b for b in BODY]
BODY[_ref_idx] = ("refs", [_old_refs[old - 1] for old in _order])
