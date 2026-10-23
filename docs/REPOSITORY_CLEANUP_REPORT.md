# Repository Cleanup Report (23 October 2026)

Repository `Eventdeck88/EventDeck`, branch `main`, starting point commit `00bb5bf` with a clean working tree. Nothing was staged, committed or pushed. Every deletion is an unstaged working-tree change and can be undone with `git checkout -- <path>` until it is committed.

## 1. Original structure (summary)

404 tracked files: `src/` 168, `docs/` 93, `.claude/` 56, `tests/` 17, `drizzle/` 17, `e2e/` 14, `public/` 12, `scripts/` 11, plus root configuration. `.git` is about 57 MB, mostly report binaries (each report `.docx` is about 8 MB). The structure already follows Next.js App Router conventions and was kept: no source, migration, configuration or asset directories were moved.

## 2. Files removed

| Path | Category | Why removal is safe |
| --- | --- | --- |
| `docs/reports/presentation/~$EventDeck_MCA_Presentation.pptx` | B, editor temp file | 165-byte Microsoft Office lock/owner file (contains only a user name), created while the deck was open and committed by accident. No references. |
| `docs/reports/final-report/working-notes/EventDeck_Final_Report.generated.docx` | B, regenerable output | Generator output before Word's field refresh; the final `EventDeck_Final_Report.docx` is kept. Rebuilt by `build_report.py`. Only mention: a historical line in `docs/reports/originality/CHANGE_SUMMARY.md`. |
| `docs/reports/final-report/working-notes/EventDeck_Project_Report_Revised.generated.docx` | B, regenerable output | As above, for the revised report (`EventDeck_Project_Report_Revised.docx` kept). `SIMILARITY_CHECK_GUIDE.md` uses this path only as the rebuild *output*. |
| `docs/development/WINDOWS_SETUP_AND_RUN.md` | B, outdated doc with replacement | 3-line redirect stub to `docs/WINDOWS_SETUP_AND_RUN.md`; no file linked to it. |

Total: 4 files, about 16 MB from the working tree (the history still holds them).

## 3. Files changed

| File | Change |
| --- | --- |
| `.gitignore` | Templates kept trackable (`!.env.example`, `!.env.test.example` next to `.env*`). Added ignore rules: `Thumbs.db`, `*.key`, `*.dump`, `/scripts/backups/` (local database dumps), `*.swp`, `*~`, `~$*` (Office lock files), `.idea/`, `*.generated.docx`. Checked: no tracked file other than the deleted ones matches an ignore rule. |
| `.env.example` | Added the optional `NEXT_PUBLIC_SITE_URL` (read by `src/lib/url.ts`, previously undocumented in the template). |
| `README.md` | Rewritten as a concise landing page (features, stack, architecture, setup, commands, deployment, status, docs, license). Detailed procedures moved to or linked from `docs/`. |
| `docs/architecture/PROJECT_ARCHITECTURE.md` | Mermaid request-flow diagram added; §8 "Database Connections" corrected: it claimed `max_pipeline: 0` fixed the pooler hang (it breaks transactions; the current code uses 1, which does not prevent the hang). |
| `docs/troubleshooting/TROUBLESHOOTING.md` | §1.2 corrected the same way, with the measured results and the session-pooler workaround. |
| `docs/WINDOWS_SETUP_AND_RUN.md` | Troubleshooting row for the pooler issue corrected. |
| `docs/deployment/DEPLOYMENT_GUIDE.md` | Build-blocker status note and a §9 Rollback section added. |
| `docs/README.md` | Index updated for the new documents. |

## 4. Files created

`docs/PROJECT_MAINTENANCE_MANUAL.md` (19 chapters, with Mermaid architecture, ER, state and sequence diagrams), `docs/development/DEVELOPMENT_SETUP.md`, `docs/testing/TESTING.md`, and this report.

Not created because an equivalent already exists (improved instead): an architecture doc (`docs/architecture/PROJECT_ARCHITECTURE.md`), a deployment doc (`docs/deployment/DEPLOYMENT_GUIDE.md`), `CONTRIBUTING.md` (`docs/development/CONTRIBUTING.md`) and a second env template (`.env.example` exists). The brief's `documentation/` paths map to the repository's established `docs/` folder.

## 5. Deliberately preserved

- All source (`src/`), migrations `drizzle/0000`–`0008` with `meta/`, tests, e2e, scripts, `package.json`, `package-lock.json`, configs, `vercel.json`, `.env.example`, `.env.test.example`.
- `AGENTS.md`: written by `next dev`; deleting it only makes `next dev` recreate it.
- Academic deliverables: original and revised reports (`.docx` + `.pdf`), presentation, figures and their SVG/Python sources, report generator, test logs cited by the report, originality audit.
- `docs/testing/EVENTDECK_TEST_CREDENTIALS_AND_PAYMENTS.pdf`: checked; it contains no passwords (it names the `SEED_DEMO_PASSWORD` variable) and only Razorpay's published test card numbers.

## 6. Left untouched, needs the owner's decision

| Item | Why it was not removed |
| --- | --- |
| `.claude/` (56 files) and `skills-lock.json` | Claude Code project settings (`.claude/launch.json` defines the dev-server preview) and an installed third-party "understand" skill (55 files). This is tooling, not application code; for a public repository you may prefer to delete or ignore `.claude/skills/` and `skills-lock.json`. |
| `public/brand/` (12 files) | Brand kit (logos, icons, brand sheet). **Not referenced by application code** (the app icon is `src/app/icon.svg`) but used for the presentation and as brand assets. |
| Dependencies `date-fns`, `next-themes` | No references anywhere in `src/`, `scripts/` or config, so they are likely unused. Not removed, because that would rewrite `package-lock.json`; remove them in a dependency PR (`npm uninstall date-fns next-themes`, then `npm run verify` and `npm run build`). |
| `docs/reports/final-report/working-notes/{unit,lint,tsc}.txt` | Older test logs, but cited as evidence in the original report. |
| `scripts/backups/local_auth_backup.sql`, `local_data_backup.sql` (**not tracked**) | Local database dumps from 14 Oct 2026 (an Auth dump likely holds e-mails and password hashes). Never committed (checked across all history) and now explicitly ignored. **Recommendation:** move them out of the project folder or delete them. |

## 7. Security review

- **History scan:** all commits were searched for Supabase secret keys, JWTs, Razorpay keys, database URLs with passwords, Brevo keys, private keys, AWS and GitHub tokens. Matches were only placeholders (`.env.example`, `.env.test.example`, a doc example, an error-message example). The actual values of eight secrets in `.env.local` (DB password, Supabase secret and publishable keys, Razorpay secret and webhook secret, cron secret, demo and DSA passwords) occur in **no** commit.
- **Committed files:** only `.env.example` and `.env.test.example` among env files; no dumps or keys ever committed.
- **E-mail addresses in tracked files:** test fixtures plus the project's own root-admin address `eventdeck88@gmail.com` (intentional, in code and docs).
- **Open:** a critical Next.js advisory (see §8); an earlier QA note recommends rotating the database password once shared in a chat.

## 8. Validation (23 Oct 2026, 16:17 IST)

| Check | Result |
| --- | --- |
| `npm ci --dry-run` | OK, lockfile consistent ("up to date") |
| `npm ls --depth=0` | OK, no missing or invalid packages |
| `npm run lint` | Passed: 0 errors, 3 warnings (React Compiler notes on `watch()`) |
| `npm run typecheck` | Passed |
| Unit tests (`npx vitest run --project unit`) | **65/65 passed** |
| `npm run build` | **Failed (exit 1)**: compilation and all 35 static pages succeeded, then Next.js aborted with `SecurityFatalError` (known vulnerability in `next` 16.4.0). Reproduced twice. `npm audit --omit=dev`: 1 critical (`next` ≤ 16.4.0; GHSA-2464-fhr4-w9xw RCE in image optimization with SVG; GHSA-p3m5-59mp-jv5r Server Actions DoS); fix `next@16.4.2`. **Not upgraded**: dependency changes need the owner's approval. |
| Integration / E2E | Not run: no dedicated Supabase test project (`.env.test`). |
| Pooling probe (read-only queries against the hosted DB) | Transaction pooler + `max_pipeline: 1` → 177/200 concurrent queries timed out; `max_pipeline: 0` → transaction fails (`UNSAFE_TRANSACTION`); session pooler → all passed. Documented; **no code changed**. |

Documentation checks: relative links in new and changed docs resolve; every env var named in the docs exists in code; every `npm run` command named exists in `package.json`; no secrets in docs.

The cleanup itself changed no application code, so it cannot have changed application behaviour. Validation ran on the cleaned tree.

## 9. Remaining recommendations

1. Upgrade `next` and `eslint-config-next` to 16.4.2, then re-run `npm run verify` and `npm run build`.
2. Resolve the pooling issue (session pooler for `DATABASE_URL`, or reduce per-request query concurrency) and correct the academic report's OBS-1 wording accordingly.
3. Create the Supabase test project and re-run the integration and E2E suites.
4. Move `scripts/backups/` dumps out of the repository folder.
5. Decide on `.claude/skills/` and `skills-lock.json` for a public repository, and on the unused dependencies.
6. Choose a license before making the repository public.
7. Consider moving large binaries (report `.docx`/`.pdf`/`.pptx`) to GitHub Releases or Git LFS in future; history already contains them, so this only helps new additions.
