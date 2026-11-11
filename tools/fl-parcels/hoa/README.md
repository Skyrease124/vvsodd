# HOA status

Statuses shown on every Florida parcel card:

- **HOA confirmed**: a recorded declaration or amendment covers this specific parcel.
- **Possible HOA**: an association is linked to the subdivision, but coverage for this lot or phase is unverified.
- **HOA status unknown**: the records checked did not establish whether an HOA applies.

## How a parcel gets a status
`hoa_backfill.py` matches each listing by county + parcel ID (using `parcels/<county>.json`), parses the official legal description into subdivision, phase, block and lot (`hoa/fl.py`), and then:

1. **Confirmed** only if a validated entry in `hoa/registry/*.json` covers the exact phase, block and lot (including recorded amendments that add or remove parcels). One reviewed declaration lifts every lot it covers.
2. **Possible** if the entry exists but cannot place the lot, or if the county roll shows an association-named owner (or a common-area parcel) tied to the subdivision. A subdivision name or map boundary is a lead, never proof.
3. **Unknown** otherwise.

## Reviewing a declaration (adds `confirmed` coverage)
Copy `registry/TEMPLATE.json.txt` to `registry/<county>-<subdivision>.json`, fill it in from the recorded documents (declaration, exhibits, amendments), then run `python3 tools/fl-parcels/hoa_backfill.py`. Entries missing a recording number or source link, a coverage rule, or a verified-by and date are rejected and listed in the report. Dues need an amount, frequency, as-of date and a dated source link; otherwise leave `dues` out and the site shows "Dues unverified".

## Adding another state
Write an adapter with `parse_legal(desc, roll_legal)` and `find_leads(fetch, county_id, subdivision)` for that state's local records and register it in `ADAPTERS` in `hoa_backfill.py`. The core engine, registry format, badge, detail section and filter are state-neutral.

Run `python3 tools/fl-parcels/hoa/tests/test_hoa.py` to test the engine and backfill (uses a TEST fixture that is never published).
