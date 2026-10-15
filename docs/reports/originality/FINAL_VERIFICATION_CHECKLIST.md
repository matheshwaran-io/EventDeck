# EventDeck Report — Final Verification Checklist (15 October 2026)

| # | Check | Status | Evidence / note |
| --- | --- | --- | --- |
| 1 | Original report preserved | PASS | `EventDeck_Final_Report.docx` untouched; a rebuild of the original is text-identical to the committed copy |
| 2 | Revised report in editable format | PASS | `EventDeck_Project_Report_Revised.docx` (Word-saved) |
| 3 | `.docx` opens and is well-formed | PASS | Opened and saved by Microsoft Word; OOXML validation passed |
| 4 | Rendered for visual inspection | PASS | PDF exported by Word, 83 pages; changed pages and Table 8.7 inspected |
| 5 | TOC, list of tables, list of figures correct | PASS | 139 entries checked against PDF pages, 0 mismatches |
| 6 | Institutional formatting preserved | PASS | Same template, styles, borders, numbering, section breaks |
| 7 | Official title consistent | PASS | Identical on cover, certificate, and the presentation's slide 1 |
| 8 | Title is the approved title | NEEDS STUDENT/GUIDE CONFIRMATION | No approved synopsis in the repository |
| 9 | Technologies match the implementation | PASS | Checked against `package.json` and source |
| 10 | Roles and authorisation described accurately | PASS | Root-administrator rule added; moderators described as assignments |
| 11 | Booking, payment, ticket and refund states accurate | PASS | Checked against `transitions.ts`, `bookings.ts`, `payments.ts` |
| 12 | Database tables and migrations accurate | PASS | 17 tables (live query); 9 migration files; 0008 status explained |
| 13 | Diagrams match the architecture | PASS | Unchanged diagrams still match the code; none depict the root-admin rule (described in text) |
| 14 | Screenshots genuine and free of sensitive data | PASS | Fictional demo accounts only; no credentials |
| 15 | Test results supported by evidence | PASS | 15 Oct 15:26 logs stored; 14 Oct results labelled historical |
| 16 | Integration and E2E tests current | FAIL | Not run since 14 Oct; needs a dedicated Supabase test project |
| 17 | Incomplete features not presented as complete | PASS | Waiting lists, invite-only lists, live payments, real payouts listed as out of scope/future |
| 18 | Known defects disclosed | PASS | OBS-3 and OBS-4 open; fixed items dated |
| 19 | Overlap with the Electify report reduced | PASS | Body 3.5 % → 0.3 % (7-word sequences); see `ORIGINALITY_ISSUE_REPORT.md` |
| 20 | Similarity score from the official checker | NOT VERIFIED | No checker has been run |
| 21 | All citations matched to references | PASS | 32/32 both ways |
| 22 | IEEE ordering of references | PASS | Renumbered; in-text numbers verified |
| 23 | References verified to exist | PARTIAL | Scholarly works and 21 URLs verified; ISO/IEC 18004 not checkable online |
| 24 | Newest editions of standards cited | NEEDS STUDENT/GUIDE CONFIRMATION | Newer OWASP Top 10, ASVS, NIST 800-63, ISO/IEC 18004 editions exist |
| 25 | Acknowledgement wording | NEEDS STUDENT/GUIDE CONFIRMATION | Rewritten; facts unchanged |
| 26 | Bonafide certificate wording current | NEEDS STUDENT/GUIDE CONFIRMATION | Left as prescribed text |
| 27 | Declaration page required | NEEDS STUDENT/GUIDE CONFIRMATION | Not present in the template |
| 28 | AI-use disclosure required | NEEDS STUDENT/GUIDE CONFIRMATION | Text drafted with AI assistance; SRM policy unknown |
| 29 | Academic year on the cover | NEEDS STUDENT/GUIDE CONFIRMATION | Cover shows "October – 2026" only |
| 30 | No secrets in report or deliverables | PASS | Scanned; no keys, passwords or connection strings |
| 31 | Application source unchanged | PASS | No changes under `src/`, `drizzle/`, `scripts/` |
| 32 | Final submission readiness | PARTIAL | Ready for the student's checks: items 8, 16, 20, 24–29 remain |
