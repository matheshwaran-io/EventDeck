# EventDeck Report — Similarity and Evidence Issue Report

Scope: `docs/reports/final-report/EventDeck_Final_Report.docx` (original) compared with `EventDeck_Project_Report_Revised.docx` (revised, 15 October 2026).

**Important.** No recognised similarity checker (Turnitin, iThenticate, or the checker SRM specifies) has been run. This report does **not** state an originality or similarity score. The measurements below compare the text with **one** known document, the team's own Electify report. That document shares the institutional template and was the likeliest source of matches. They cannot predict what a checker will find against its full database.

## 1. Method

`tools/overlap_check.py` extracts paragraph text from both `.docx` files and counts how many of the EventDeck report's 7-word sequences also occur anywhere in the Electify report (`/Users/maddy/Downloads/Electify Final Report (1).docx`). This detects shared phrasing, not shared ideas.

| Measurement (7-word sequences shared with Electify) | Original report | Revised report |
| --- | --- | --- |
| Front matter (cover, certificate, acknowledgement, TOC, lists) | 210 / 530 (39.6 %) | 93 / 522 (17.8 %) |
| Body (chapters 1–9, appendices) | 323 / 9,302 (3.5 %) | **26 / 9,466 (0.3 %)** |
| Reference list | 309 / 532 (58.1 %) | 294 / 579 (50.8 %) |
| Whole document | 842 / 10,364 (8.1 %) | 413 / 10,567 (3.9 %) |

Reproduce with `python3 docs/reports/originality/tools/overlap_check.py <report.docx> "<Electify report.docx>"`.

## 2. Issues and their resolution

| # | Location | Issue type | Finding | Action |
| --- | --- | --- | --- | --- |
| 1 | Acknowledgement (p. ii) | Potential similarity concern (wording) | All six paragraphs were word-for-word identical to the Electify report's acknowledgement | **Rewritten**: same people, titles and roles, new wording. *Needs student confirmation* (it is the students' personal statement). |
| 2 | Bonafide certificate (p. i) | Prescribed institutional text | "under my supervision for the award of the Degree of Master of Computer Applications…" matches Electify | **Left unchanged**: required wording; the checker's matches here are expected. Confirm with the department that this is the current certificate text. |
| 3 | Cover page, names, register numbers, headings, captions | Standard / required text | Matches are names, institution lines and generic headings ("3.3 Functional and Non-Functional Requirements") | Left unchanged (legitimate) |
| 4 | §1.3.1, §1.3.2 (objectives, scope) | Potential similarity concern | Opening sentence and the out-of-scope sentence reused Electify phrasing | Rewritten |
| 5 | §2.2, §2.3, §2.5, §2.6 (literature survey) | Potential similarity concern | Connective sentences around the same cited sources ([Berenson], [Saltzer and Schroeder], research-gap paragraphs, Next.js paragraph) shared phrasing | Rewritten with EventDeck-specific reasoning; citations kept |
| 6 | §3.1–3.3 | Potential similarity concern | "Seat limits are not checked when a…", "The proposed system follows the overall flow…", "The functional requirements identified…" | Rewritten |
| 7 | §4.1, §4.2, §4.3, §4.4, §4.5, §4.8, §4.9 | Potential similarity concern | Architecture, technology, DFD, schema, module, interface and summary paragraphs reused Electify sentence frames | Rewritten |
| 8 | §5.7, §6 intro, §6.1–6.3 | Potential similarity concern | Summary and booking-engine paragraphs reused Electify sentence frames | Rewritten |
| 9 | §7.1–7.4, §7.9 | Potential similarity concern | Environment, structure, migration, authentication and configuration paragraphs | Rewritten |
| 10 | §8.1–8.8 | Potential similarity concern | Methodology, environment, results and limitations paragraphs reused Electify sentences ("The test run reported in this chapter…", "Within these limits, the results support…") | Rewritten |
| 11 | §9.1, §9.2 | Potential similarity concern | Conclusion openings and one future-work item | Rewritten |
| 12 | Appendix 11.1, 11.2, 11.3 intros; Table 11.1 caption | Potential similarity concern | Template-like sentences | Rewritten |
| 13 | Reference list | Legitimate overlap | 11 of the 32 entries cite the same works as Electify, in the same IEEE format | Kept: a correct citation of the same source is expected to match. Most checkers can exclude the bibliography. |
| 14 | §6.4, §7.2 tables and code identifiers | Standard terminology | Library names, versions, function names (e.g. "Drizzle ORM 0.45, drizzle-kit 0.31") | Kept (unavoidable technical terms) |
| 15 | §3.2 Table 3.1, §4.6, §7.4, Table 7.4 | **Unsupported / outdated claim** | "Administrator accounts are created only by a command-line script". The code now also grants admin to a fixed root-administrator address (`src/lib/constants.ts`, `drizzle/0008_root_admin_protection.sql`). | Corrected; the dependency on e-mail confirmation is stated as a limitation |
| 16 | §7.3, §7.9, Table 7.3 | Outdated claim | "All eight migrations"; migration 0008 is missing | Corrected to nine migrations, with how 0008 was applied |
| 17 | §8.2, §8.3, §8.7, Tables 8.1, 8.2, 8.7, 11.1 | Outdated evidence | Run of 02:06 IST (59 unit tests, 21 lint warnings, build "not repeated"); OBS-1/OBS-2 "Open" | Replaced with the 15 Oct 2026 15:26 IST run (63/63, 0 errors + 3 warnings, build OK, 46 routes); OBS-1/OBS-2 marked fixed with evidence; QA-010 (open redirect) and QA-011 (seed) added |
| 18 | References | Citation-style issue | Not numbered in order of first citation (IEEE) | Renumbered; all 32 in-text citations updated (verified in the PDF) |
| 19 | References [16]–[18], [22] | Edition currency | Newer editions of OWASP Top 10, ASVS, NIST SP 800-63B and ISO/IEC 18004 exist | Edition-specific URLs/DOI added; whether to cite newer editions is flagged in `REFERENCE_AUDIT.md` |
| 20 | Whole report | **AI-assistance disclosure** | The report text, diagrams and tooling were drafted with an AI assistant (Claude) in development sessions for this repository | Not changed. *Needs student/guide confirmation* of SRM's current AI-use rules and whether a declaration is required. Some checkers also run AI-writing detection. |

## 3. Items requiring external verification or guide approval

- Official project title (no approved synopsis in the repository).
- Rewritten acknowledgement wording.
- Current bonafide certificate text, and whether a declaration page is required.
- AI-use disclosure requirement.
- The institution's similarity checker, its exclusion settings (bibliography, quotes, small matches) and the acceptable threshold.
