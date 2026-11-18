# Parcel data audit

Read-only. Never edits or deletes a record.

```
node tools/audit/audit.mjs [--probe] [--today=YYYY-MM-DD]   # audit + registry (+ polite connection checks with --probe)
node tools/audit/report.mjs [YYYY-MM-DD]                    # plain-language report (reports/audit-<date>.md)
node tools/tests/data-status.test.mjs                       # status/freshness rules on real records
```

* `kinvest-liens/liens/states/data-status.js` is the single source of truth for **status** (tax lien, deed sale, county-held, state-held, over-the-counter, sold, redeemed, canceled, historical, unknown) and **freshness** (current ≤7 days, aging ≤30, outdated). The website and this audit both use it.
* A status of sold / redeemed / canceled is only given when the official record says so. A listing missing from a newer list, or one whose sale date has passed, is never called sold or available.
* `data-registry.json` (written by the audit) lists every county we hold data for: official page, direct file (if any), update method, last copied date, GIS match counts, last connection check.
* `--probe` sends one request per official page with the honest user agent, one second apart. A 403 is recorded as "refused automated check" and is never worked around.
* "Verified" means: the parcel ID is in an official GIS layer and owner/acreage agree wherever both sources have them. Amounts, dates and rates are copied from the county list and are not independently verified.
* Automated updates and duplicate-import protection already live in `tools/imports` (snapshots by sha256, failed or incomplete runs are logged and change nothing) and `tools/taxsales` (health checks). Run the audit after each import.
