# Florida parcel coverage report

Generated 2026-11-11 by tools/fl-parcels/backfill.py. One row per county; counts are unique parcels.

| County | parcels | matched | ambiguous | unmatched | mineral only | condo unit | other unmatched | aerial | map preview | no owner | no address | area estimated | flood unavailable | wetlands unavailable | roads unavailable | zoning unavailable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alachua | 98 | 77 | 0 | 21 | 19 | 0 | 2 | 77 | 0 | 0 | 76 | 1 | 0 | 0 | 0 | 77 |
| Bay | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| Duval | 116 | 116 | 0 | 0 | 0 | 0 | 0 | 116 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 116 |
| Escambia | 27 | 19 | 0 | 8 | 1 | 0 | 7 | 19 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 19 |
| Hernando | 19 | 18 | 0 | 1 | 0 | 0 | 1 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 18 |
| Hillsborough | 47 | 47 | 0 | 0 | 0 | 0 | 0 | 47 | 0 | 0 | 30 | 0 | 0 | 0 | 0 | 47 |
| Leon | 60 | 59 | 0 | 1 | 0 | 1 | 0 | 59 | 0 | 0 | 22 | 0 | 0 | 0 | 0 | 0 |
| Manatee | 95 | 90 | 0 | 5 | 0 | 0 | 5 | 90 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Miami-Dade | 162 | 12 | 0 | 150 | 0 | 150 | 0 | 12 | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 12 |
| Nassau | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| Osceola | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| Palm Beach | 261 | 261 | 0 | 0 | 0 | 0 | 0 | 261 | 0 | 0 | 99 | 16 | 0 | 0 | 0 | 261 |
| Pasco | 85 | 80 | 0 | 5 | 0 | 0 | 5 | 80 | 0 | 0 | 80 | 0 | 0 | 0 | 0 | 80 |
| Santa Rosa | 716 | 117 | 0 | 599 | 598 | 0 | 1 | 117 | 0 | 0 | 89 | 32 | 0 | 0 | 0 | 117 |
| Sarasota | 85 | 85 | 0 | 0 | 0 | 0 | 0 | 85 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 85 |
| Volusia | 340 | 13 | 0 | 327 | 324 | 1 | 2 | 13 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 13 |
| Walton | 42 | 4 | 0 | 38 | 38 | 0 | 0 | 4 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 4 |
| **Total** | 2166 | 1011 | 0 | 1155 | 980 | 152 | 23 | 1011 | 0 | 0 | 414 | 52 | 10 | 0 | 0 | 862 |

Unmatched parcels split into mineral-only interests (no surface lot exists to picture), condo units (not mapped separately) and other IDs that need a person to check. “Unavailable” means the source did not return data for that lot, not that the lot is clear. Zoning is only filled in where we have a checked zoning layer (Leon, Manatee).

Parcels needing review are listed in review.csv.
