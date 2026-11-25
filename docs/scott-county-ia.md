# Scott County, Iowa (IA-scott): parcel repair

**Status:** prepared for owner review. Nothing has been imported, approved, released or published. The 144 list records
were not changed, and no record was created or duplicated. No public file carries a position or an official parcel ID
(`tests/publish_boundary.test.mjs`).

**Preview:** https://deploy-preview-454--pricepocketasset.netlify.app/owner/brain/ (sign in as the owner).

## Results (audit: `netlify/lib/data/parcel-matches/IA-scott.json`)

| Result | Records | What happens next |
|---|---|---|
| **Matched**: exact PIN, the list address agrees with the official site address, the official polygon holds the point | **22** | Import, then batch-approve |
| **Identifier candidate**: exact PIN in the official parcel layer, owner agrees, the list has no street address | **23** (17 strong, 6 review) | Verify each on the official record, then approve |
| **Lot candidate**: manufactured home; the lot address matches one official E911 address point | **65** | Verify the home's serial or title number, then approve |
| Manufactured home; no official address point for this lot | 31 | No position |
| Retired number: found only in the 2025 parcel history, with no address or owner | 1 | No position |
| No official record: no PIN in any free layer, and no address | 2 | No position |
| **Total** | **144** | |

Candidates are never matched automatically. In the intake they arrive as "awaiting verification" with their coordinates
shown as unverified, so they stay off the map until the owner verifies and approves them.

## What was checked (free county services only)

- **Parcel layer** (`Cadastral/FeatureServer/3`): exact PIN; owner (`DeedHold`); assessor acreage (`Gross_AC`) against the
  drawn polygon; legal description (`LegalDesc1`); tax jurisdiction (`TaxJuris`).
- **Subdivision layer** (`Cadastral/FeatureServer/1`): the subdivision at each parcel's point, compared with its legal description.
- **City Limits** (`City_Limits/FeatureServer/0`): inside or outside city limits, compared with the tax jurisdiction.
- **Parcel history 2025** (`SCFeatures_DBO_Parcel_Hist_25`, layer 28) and **ParcelTaxDeed**: the 99 numbers that are not in the
  parcel layer, case-insensitive and by alternate name. The history holds one of them (a retired number). ParcelTaxDeed holds
  none. The 23 identifier candidates were also checked against ParcelTaxDeed and hold no match there either.
- **E911 address points** (`SC_Addresses/FeatureServer/0`): the street number, street and LOT unit of each lot record.
- **Parcel layer at the same street number**: land context only, shown to the owner as text.

Not available from the free county GIS: manufactured-home serial or title numbers, the county treasurer's mobile home tax
records, and the legal description, acreage and jurisdiction on the list itself (the list has only the PIN and the owner).

## Rules applied

- A cross-check never matches a record. It only records each official check and the candidate's position.
- **A manufactured home never receives a land parcel.** Its only candidate position is the official address point for its own lot.
  Land parcels at the same street number are listed as context. All 65 lot candidates have one at the same street number and
  street, and 64 of those are manufactured-home park parcels (class M).
- **Strength of an identifier candidate:** *strong* when the owner, acreage, legal description and jurisdiction all agree;
  *review* when one differs or cannot be checked.
- Acreage agrees within 0.001 acre or 2 percent of the assessor's figure.

### The six identifier candidates for a closer look

- **P1401C09A**: the drawn parcel is 0.014 acre, the assessor's figure is 0.023 acre. The legal description is "part of Lot 70".
- **F0036-05**: 0.045 acre drawn against 0.050 acre. The legal description excepts the east 212 feet.
- **F0049-49A**: the legal names LeClaire's 2nd Addition, but the subdivision layer has no polygon at the parcel.
- **G0051-24**: the legal says "Original Town"; the subdivision layer says "Original Town of Davenport". Probably a naming convention.
- **E0017-09**: a metes-and-bounds legal description, with no subdivision polygon at the parcel.
- **31851-18**: the legal says "Clough's, Wm F Subd"; the subdivision layer says "William Clough's Subdivision". Probably initials.

The other 17 agree on every official check. Owner name agreement is checked for all 23.

## Owner steps (preview only)

1. Open the preview owner dashboard (signed in as the owner) and find **Parcel matches**.
2. Choose **State: IA** and **County dataset: Scott · 144 records**. The summary should read
   "Scott, IA: 144 records · 22 matched to an official parcel (22 with a boundary) · 122 pending · 0 already in the approval queue".
3. Press **Import matched records for review…** and confirm. Expected: "Imported 144 from Scott (22 ready for approval, 122 pending
   investigation, 0 already present)." Importing again adds nothing.
4. **Approve the 22 matches:** press **Select all ready (22)**, then **Approve selected…** and confirm. Pro members see them now;
   Free and anonymous viewers see them 48 hours later. Each record keeps its own audit entry under the batch id.
5. **Verify the 88 candidates one at a time** (they are never approved by batch). Open **Verify this item**, paste the official
   record's link (it is in the card's audit note, "Official record: …"), check the record, and tick the three checks.
   - *Identifier candidates (23):* confirm the PIN, owner, legal description and parcel outline on the official record.
     Check the six listed above first.
   - *Lot candidates (65):* the address point places the lot, not the home. Tick "the parcel number and the address match"
     only after you have checked the home's serial or title number on the county treasurer's mobile home record. If the record
     cannot be found, reject the item.
   - Notes must be at least 15 characters. Then approve as usual.
6. The 34 records with no position have no map location to approve. Their reasons are in **Pending for investigation**.
7. Nothing else changes: Rochester approvals, release timestamps, Stripe, subscriptions, support pages and the NVIDIA, Geoapify
   and Wayne GIS checks are untouched.

## Reproduce

```
node tools/parcel-match/run.mjs --dataset IA-scott        # matches the list to the layer by PIN and address
node tools/parcel-match/crosscheck-scott.mjs               # the cross-checks above (cached under tools/parcel-match/cache)
node tools/parcel-match/crosscheck-scott.mjs --offline     # the same audit from the cache, without any request
node --test tests/scott-crosscheck.test.mjs tests/scott-county-match.test.mjs
```

Run the cross-check after the matcher: the matcher rewrites the audit from the list.

## Not done

- No owner approval, import, release or publication by me.
- Manufactured-home serial and title numbers are not in any free county layer. Verifying the 65 lot candidates needs the
  county treasurer's mobile home record, which I could not check from here.
- The 31 manufactured homes without an address point and the 3 records with no official record stay without a position.
