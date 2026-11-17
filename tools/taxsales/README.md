# Auction updates: how official sources are added

Everything on the county "Local News & Notices" tab (official notices) and the parcel "Auction Updates" section comes from
`kinvest-liens/liens/states/upcoming-sales.json`, built by `build.py` from official files. Nothing is guessed.

## Add a county (or a whole state)
1. Add one entry to `counties.json`: `state`, `county`, `file` (name of its `liens-<file>.js` list, if any), `integrated`
   (sale types we load from official files: `taxdeed`, `taxlien`, `otc`, `laft`), `calendar` ({name, url}: the official auction calendar),
   `links` (more official pages) and `probe` ({url, contains}: a page `check.py` can fetch to record "last successful check";
   `null` if the site refuses automated requests; never work around a block).
2. A county with `integrated: []` still gets the "Open official auction calendar" link and a clear "no integrated feed" note.
3. County news needs nothing else: the county is allowed in `netlify/functions/countynews.mjs` as soon as it is in the registry.

## Add a sale list
Save the official list as `sources/<county>-<date>.json` (see `volusia-2026-11-17.json`): `county`, `type` (`taxdeed` or `laft`), `saleId`,
`saleDate`, `saleTime`, `tz`, `auctionUrl`, `officialPage`, `source` {name, url, published, checked}, `items`.

## Record a change (only when an official source confirms it)
* Whole sale: add `"event": {"status": "rescheduled"|"postponed"|"canceled", "newDate": "...", "newTime": "...", "note": "...", "confirmedBy": {"name": "...", "url": "https://...", "date": "YYYY-MM-DD"}}`.
* One parcel: set the item's `status` (`rescheduled` needs `newDate`). A parcel marked by the official list itself is confirmed by that list.
* `build.py` refuses a canceled / postponed / rescheduled status without a named https source and date.
* A listing that simply vanishes from a newer copy of the same official list becomes `gone` ("Status unverified", last time seen). It is never turned into "canceled".

## Run
```
python3 tools/taxsales/check.py     # records which official pages answer (tools/taxsales/health.json)
python3 tools/taxsales/build.py     # rebuilds upcoming-sales.json
python3 tools/taxsales/tests/test_build.py
```
When an official page fails, listings that depend on it show "Status unverified" with the last successful check time.
