# Running the Official Similarity Check on the EventDeck Report

No similarity checker has been run on this report yet. Nothing in this repository should be read as a pass or a score.

## 1. Submit through the approved checker

1. Ask the project guide or the department which checker SRM requires (for example Turnitin or iThenticate through the library) and what threshold applies to MCA project reports.
2. Submit `docs/reports/final-report/EventDeck_Project_Report_Revised.docx`, or the PDF if the portal requires it. Submit the final version, after the confirmations in `FINAL_VERIFICATION_CHECKLIST.md` have been made.
3. Use the institution's standard settings. If the guide allows it, the usual exclusions are the bibliography, quoted material and very small matches. Do not change settings on your own to lower the number.

## 2. Keep the result

Download the full similarity report (the version that shows each matched passage and its source). Store it with the project records, for example `docs/reports/originality/similarity-report-<date>.pdf`. Record the date, checker and settings.

## 3. Read the matches, not just the percentage

Open each highlighted passage and decide which kind it is:

| Kind of match | Example in this report | What to do |
| --- | --- | --- |
| Prescribed institutional text | Bonafide certificate, "Submitted in partial fulfilment…" | Leave it; mention it to the guide if it counts against the total |
| Names, titles, headings | Student names, "Literature Survey", "Table of Contents" | Leave it |
| Reference list entries | The same paper cited in the same IEEE format | Leave it; ask for bibliography exclusion |
| Technical terms | "Server Actions", "row-level security", library names and versions | Leave it |
| Our own earlier work | The team's Electify report (the main overlap source before this revision) | Check with the guide whether self-overlap counts; rewrite any remaining sentence-level repeats |
| A real sentence-level match with an outside source | A paragraph matching a website or paper | Rewrite it in your own explanation of EventDeck, and cite the source if the idea came from it |
| Missing attribution | An idea or figure from a source without a citation | Add the citation; never delete a citation to lower the score |

## 4. Revise legitimately

- Rewrite by explaining what EventDeck does, with its own code, decisions and evidence. Do not swap synonyms or reorder words.
- Never use hidden text, white characters, swapped look-alike letters, images of text or similar tricks. They are academic misconduct and checkers detect them.
- Keep quotations exact, in quotation marks, with citations.
- If you edit the report text, edit `working-notes/report_content_revised.py` and rebuild. That keeps the document, the TOC and this audit trail consistent:

  ```bash
  cd docs/reports/final-report
  REPORT_CONTENT=report_content_revised python working-notes/build_report.py "<institutional template .docx>" working-notes/EventDeck_Project_Report_Revised.generated.docx
  ```

  Then refresh fields in Word (`working-notes/word_refresh.applescript`) or open the file in Word and update the table of contents.

## 5. When unsure, ask

If a match's interpretation is unclear, or the checker also reports AI-generated text, discuss it with the project guide before changing anything. This report was drafted with AI assistance; disclose that if SRM's rules require it.

## 6. Re-check

After legitimate revisions, re-submit only as often as the institution allows (some portals limit re-submissions or keep earlier submissions in their database). Keep every generated report.

## Self-check before submitting

This measures overlap only with the Electify report, not with the checker's database:

```bash
python3 docs/reports/originality/tools/overlap_check.py docs/reports/final-report/EventDeck_Project_Report_Revised.docx "<path to Electify report .docx>"
```
