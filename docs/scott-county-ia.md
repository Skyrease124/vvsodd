# Scott County, Iowa (IA-scott): parcel repair

**Status:** matched records are prepared for owner import. Nothing has been imported, approved, released or published.
The 144 list records were not changed, and no record was created or duplicated.

## Source

- Service: `https://services.arcgis.com/ovln19YRWV44nBqV/arcgis/rest/services/Cadastral/FeatureServer`, "Ownership layers of
  Scott County, Iowa" (ArcGIS item `09c82cc24dd24af6beb2ebf85bd6fa30`, copyright "Scott County, Iowa GIS").
- Layers: 0 Parcel Points (points) · 1 Subdivision (polygons) · 2 Block (polygons) · **3 Parcel (polygons, used)** ·
  4 ROW (polygons) · 5 Lot (polygons).
- Layer 3 fields used: `PIN` (parcel identifier), `PropertyAddress` (site address), `AlternateID`, `Gross_AC`.
  Last data edit 2026-11-13.
- Not used: layer 0 (same PIN, no polygons). Layer 5 Lot has only a lot number, so it cannot be tied to a record. Layer 1
  Subdivision has names only. The ZIP fields in layer 3 are mailing ZIPs, not site ZIPs, so ZIP is not crosschecked.

## Matching rules (the same tool and rules as Rochester)

- Identifier: the PIN is compared exactly as written. A record whose number differs in case or punctuation is not matched.
- Address: the house number and street on the list must agree with the layer's site address. A disagreement is a conflict;
  nothing is matched elsewhere.
- Position: taken only from the official polygon. The point must lie inside the polygon and inside Scott County's bounds.
  Records without a verified polygon get no position.

## Results (audit: `netlify/lib/data/parcel-matches/IA-scott.json`)

| Result | Records |
|---|---|
| **Matched**: PIN found, list address agrees with the layer, polygon and point verified | **22** |
| Not placed: PIN found, but the list has no address, and the layer has no site address for these parcels either | 23 |
| Not placed: no address on the list, and the PIN is not in the layer | 3 |
| Not placed: PIN not in the parcel layer (96 with an address) | 96 |
| **Total** | **144** |

- Address conflicts: none. Every PIN that had an address on both sides agreed with the layer.
- Leads: 81 unmatched records have parcels at the same street address in the layer. These are shown to the owner as
  leads only. They are never matched automatically.
- Of the 99 identifiers not in the layer, 94 come with a "Lot NNN" address. This pattern fits manufactured-home lots keyed by
  serial or title numbers, which the parcel layer does not carry. They cannot be placed from this source. Placing them on a
  park or a lot polygon would be a guess about a different parcel, so they stay pending.

## For the owner

1. Review the 22 matches and the 23 identifier-only records before importing. The 23 have an official PIN but no address to
   check, so confirm them against the county record first.
2. Import the audit through the owner dashboard (`import-matches` with `dataset: "IA-scott"`), then approve the matched
   records in batches. Approval keeps one audit entry per record, and Pro members see the released records 48 hours before
   Free visitors.
3. The published list (`kinvest-liens/liens/states/`, `kinvest-liens/map/data/IA-scott.json`) carries no positions. Positions
   appear on the map only after approval, through the server feed.

## Not done

- No owner approval, no import, no release, no publication.
- No positions added to any public file. The publish-boundary test covers this audit.
