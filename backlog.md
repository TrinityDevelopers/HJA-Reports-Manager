# Backlog

Planned work that is not yet started. New report types should follow `.cursor/skills/add-report-type/SKILL.md` and `backend/data/README.md`.

---

## Make Moisture Contents entries dynamic (multi-boring per report)

Moisture Contents should be **per-request**, not per-boring. Pack as many borings as will fit onto each sheet, using the same smart-fit as the lab request summary.

### Notes

- Today the schema is `labRequest.mode: "per-boring"` (`backend/data/schemas/moisture-contents.json`) with `maxEntries: 25`. Lab request generation only understands `per-sample` and `per-boring` (`packages/shared/src/labRequestSchema.ts`, `LabRequestService`).
- Add a **per-request** mode: one Moisture Contents report for the whole lab request (not one per boring), with sample rows from every boring that requested MC.
- Rework the sheet for **dynamic entry rows**, same pattern as lab request summary (`dynamicEntryRows` in `backend/src/exports/dynamicEntryRows.ts`, config in `backend/data/lab_request/lab_request_summary_template_def.json`).
- Find the max sample/spacer rows that still fit on one printed page; set that as `maxEntries`.
- On export, pack whole borings onto as few sheets as possible — reuse `paginateLabRequestBorings` in `backend/src/exports/labRequestExport.ts`:
  - Fill a page up to `maxEntries` (samples + in-page spacers between borings)
  - A single boring larger than `maxEntries` still gets its own page (overflow allowed)
  - No spacer at a page break
- Keep boring number on the first sample of each boring, with a blank spacer row between borings on the same page (same as the summary sheet).
