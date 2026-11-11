# Florida HOA status coverage report

Generated 2026-11-11 by tools/fl-parcels/hoa_backfill.py. Counts are unique parcels.

| County | parcels | confirmed | possible | unknown | no subdivision | mineral | leads |
|---|---|---|---|---|---|---|---|
| Alachua | 98 | 0 | 2 | 96 | 12 | 19 | 2 |
| Bay | 3 | 0 | 0 | 3 | 1 | 0 | 0 |
| Duval | 116 | 0 | 0 | 116 | 115 | 0 | 0 |
| Escambia | 27 | 0 | 0 | 27 | 23 | 1 | 0 |
| Hernando | 19 | 0 | 1 | 18 | 2 | 0 | 1 |
| Hillsborough | 47 | 0 | 2 | 45 | 18 | 0 | 2 |
| Leon | 60 | 0 | 3 | 57 | 22 | 0 | 3 |
| Manatee | 95 | 0 | 0 | 95 | 56 | 0 | 0 |
| Miami-Dade | 162 | 0 | 0 | 162 | 9 | 0 | 0 |
| Nassau | 8 | 0 | 0 | 8 | 5 | 0 | 0 |
| Osceola | 2 | 0 | 0 | 2 | 2 | 0 | 0 |
| Palm Beach | 261 | 0 | 0 | 261 | 67 | 0 | 0 |
| Pasco | 85 | 0 | 1 | 84 | 31 | 0 | 1 |
| Santa Rosa | 716 | 0 | 3 | 713 | 577 | 63 | 3 |
| Sarasota | 85 | 0 | 0 | 85 | 30 | 1 | 0 |
| Volusia | 340 | 0 | 0 | 340 | 16 | 323 | 0 |
| Walton | 42 | 0 | 0 | 42 | 32 | 8 | 0 |
| **Total** | 2166 | 0 | 12 | 2154 | 1018 | 415 | 12 |

**Confirmed** needs a reviewed recorded declaration in `hoa/registry/`. **Possible** means a lead exists (an official-roll association owner tied to the subdivision, or a reviewed declaration that does not clearly cover the lot). **Unknown** means the records checked did not establish whether an HOA applies; most of these have no subdivision in the legal description, or are mineral interests.

Review queue (subdivisions with a lead, most listings first): `hoa-review-queue.csv`. Reviewing one declaration lifts every lot it covers.
