# Backlog

Planned work that is not yet started. New report types should follow `.cursor/skills/add-report-type/SKILL.md` and `backend/data/README.md`.

---

## Moisture Contents — dynamic entry rows (deferred)

Moisture Contents is now **per-request** with summary-style boring packing on static 29-row sheets.

Still deferred: rework the sheet for **dynamic entry rows** (`dynamicEntryRows` in `backend/src/exports/dynamicEntryRows.ts`). Sign-off boxes sit below the entry rows, so their cell mappings would need to shift when rows are inserted. Until then, `maxEntries` stays 29 (`A12-40`) and oversized borings are split across pages at export.
