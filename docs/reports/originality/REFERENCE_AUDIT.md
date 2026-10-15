# EventDeck Report — Citation and Reference Audit

Style: IEEE (numeric, in order of first citation), as used by the institutional template. This is an *assumption*: no SRM citation-style document is in the repository. **NEEDS STUDENT/GUIDE CONFIRMATION.**

## 1. Citation matching (revised report)

| Check | Result |
| --- | --- |
| References listed | 32 |
| In-text citations without a reference entry | 0 |
| References never cited | 0 |
| Numbered in order of first citation | **Fixed**: previously [22] and [27] were cited before [2] and [19]. Old→new mapping: 22→2, 2–18→3–19, 27→20, 19–21→21–23, 23–26→24–27; 1 and 28–32 unchanged. |
| Renumbering applied to the text | Verified in the PDF (e.g. Saltzer and Schroeder [12], Berenson et al. [7], RFC 4086 [21]) |

## 2. Source verification

Bibliographic details for the scholarly works were checked against standard bibliographic records known to the editor. Web sources were checked for HTTP availability on 15 Oct 2026.

| New # | Source | Type | Verification | Notes |
| --- | --- | --- | --- | --- |
| 1 | Gray & Reuter, *Transaction Processing*, 1993 | Book | Verified (well-known textbook) | — |
| 2 | Jena & Dalal, Idempotency-Key header | IETF Internet-Draft | Datatracker page 200; authors confirmed there | A draft, not a standard; marked "work in progress". URL added. |
| 3 | Codd 1970, CACM 13(6) 377–387 | Journal | Verified | — |
| 4 | Chen 1976, ACM TODS 1(1) 9–36 | Journal | Verified | — |
| 5 | Silberschatz, Korth, Sudarshan, 7th ed., 2019 | Book | Verified | Some catalogues list 2020; publisher date 2019 |
| 6 | Eswaran et al. 1976, CACM 19(11) 624–633 | Journal | Verified | — |
| 7 | Berenson et al. 1995, SIGMOD, pp. 1–10 | Conference | Verified | — |
| 8 | Kleppmann 2017 | Book | Verified | — |
| 9–11 | PostgreSQL docs: explicit locking, isolation, INSERT | Product documentation | URLs 200 | "current" docs change over time; access date given |
| 12 | Saltzer & Schroeder 1975, Proc. IEEE 63(9) | Journal | Verified | — |
| 13 | Ferraiolo & Kuhn 1992, NCSC, pp. 554–563 | Conference | Verified | — |
| 14 | Sandhu et al. 1996, IEEE Computer 29(2) 38–47 | Magazine | Verified | — |
| 15 | Supabase RLS docs | Product documentation | URL 200 | — |
| 16 | OWASP Top 10:2021 | Industry standard | URL changed to `https://owasp.org/Top10/2021/` (200) | The landing page now shows **OWASP Top 10:2025**. Decide which edition to cite. |
| 17 | OWASP ASVS 4.0.3 (Oct 2021) | Industry standard | URL changed to the tagged v4.0.3 release (200) | **ASVS 5.0.0** is now the latest stable version |
| 18 | NIST SP 800-63B (Grassi et al., Jun 2017) | Government standard | DOI 10.6028/NIST.SP.800-63b added | NIST states it was **superseded by SP 800-63-4 on 1 Aug 2025**. Citing the 2017 edition is accurate for the guidance used, but consider citing SP 800-63B-4. |
| 19 | RFC 7519 (May 2015) | IETF standard | URL added (200) | — |
| 20 | Supabase server-side auth docs | Product documentation | URL 200 | — |
| 21 | RFC 4086 (Jun 2005) | IETF BCP | URL added (200) | — |
| 22 | ISO/IEC 18004:2015 | ISO standard | Not checkable online (iso.org blocks automated access, 403) | A **2024 edition** (ISO/IEC 18004:2024) has been published; confirm which edition to cite |
| 23 | Razorpay docs | Product documentation | URL 200 | — |
| 24 | OWASP CSV Injection | Community page | URL 200 | — |
| 25–31 | Next.js, React, Drizzle, Supabase Realtime, Supabase connect, Vitest, Playwright docs | Product documentation | URLs 200 | Framework documentation, not scholarly sources; labelled as online documentation |
| 32 | WCAG 2.2 (2023) | W3C Recommendation | URL 200 | — |

## 3. Claims and their evidence

| Claim in report | Evidence | Status |
| --- | --- | --- |
| Concurrency results (20 buyers → 5 seats; 4 scans → 1 check-in; checkout + 2 webhooks → 1 confirmation) | `docs/qa/QA_FINAL_REPORT.md` (run of 14 Oct 2026 on a local stack since removed) | Supported but **historical**; the report labels them so. Re-run needed. |
| 63/63 unit tests; lint 0 errors/3 warnings; build OK, 46 routes | `final-report/working-notes/*-2026-10-15-1526.txt` | Supported (executed during this task) |
| Admin-page fix (91/200 timeouts → 200/200 in ≈1.9 s; pages 1.2–2.1 s) | Measurements made in the 15 Oct 2026 development session, recorded in `docs/architecture/PROJECT_ARCHITECTURE.md` §8 and `docs/troubleshooting/TROUBLESHOOTING.md` | Supported by session records; no raw log file stored |
| RLS on all 17 tables | Read-only catalogue query, 15 Oct 2026 | Supported |
| Brevo SMTP sends authentication e-mails | `docs/deployment/DEPLOYMENT_GUIDE.md`; public DKIM/DMARC records | Configuration is in the Supabase dashboard and **not verifiable from the repository**; worded accordingly |
| eventdeck.online is the live site | HTTP 200 from Vercel, 15 Oct 2026 | Supported (presentation slide only) |

## 4. Outstanding items

- Decide whether to cite the newest editions (OWASP Top 10:2025, ASVS 5.0.0, NIST SP 800-63-4, ISO/IEC 18004:2024). If so, verify their exact bibliographic details from the publishers before editing. **Not changed**, because the report describes guidance consulted during development.
- Confirm the citation style with the department.
- No quotations or adapted figures from external sources were found. All 8 diagrams were drawn for this project (`assets/diagram-source/diagrams.py`), and the screenshots are of EventDeck itself.
