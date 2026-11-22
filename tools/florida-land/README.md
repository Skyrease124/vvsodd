# Florida offline land discovery

Use local files already authorized for this purpose. The tools make no HTTP calls. Keep original source
documents and their retrieval dates. A processed row, an exact parcel match, an active official sale,
owner review approval, and publication are distinct events.

| Source | Accepted local extracts | Access and freshness |
| --- | --- | --- |
| [FloridaGIO statewide cadastral layer](https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0) | ArcGIS JSON, RFC 7946 GeoJSON, or local Shapefile via GDAL | Layer metadata advertises public Query and Extract with pagination up to 2,000 records per response. Native EPSG:6439. Verify release date, confidentiality, and redistribution terms for the actual extract. [Item details](https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2) |
| [FDOR assessment data access](https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx) | Authorized NAL CSV with CO_NO, PARCEL_ID, and PHY_ADDR1 | Keep the tax roll year and release stage with the original file. Use the published access or request process. Observe suppression and confidentiality requirements. Tax assessment cannot establish sale availability. |
| [Miami-Dade surplus property](https://www.miamidade.gov/global/business/realestate/surplus-real-properties-for-sale.page) | Reviewed CSV transcribed from specific official listings or notices | County links to external auction services. Ownership and surplus status alone are insufficient for current availability. Check individual auction dates and terms. |
| [Palm Beach Clerk tax deed sales](https://www.mypalmbeachclerk.com/departments/courts/tax-deeds/sale-information) | Reviewed CSV with links to specific official notices or records | The Clerk identifies its notice and auction systems. Live schedules and status can change. No programmatic feed or redistribution permission has been established. |
| [Florida DEP public land sales](https://floridadep.gov/lands/bureau-real-estate-services/content/surplus-properties-sale) | Reviewed CSV for property-specific public offerings | State availability and bid deadlines are listing-specific. Source adapters never submit applications or bids. |

Normalize only the source fields in the accepted schema. Leave unverified fields empty. Geometry
requires a reviewed `CLASSIFICATION=surface`. Include `CLASSIFICATION=mineral` for confirmed
mineral interests. Santa Rosa identifiers bearing the known M suffix are excluded from matching.
`VACANT=true` requires official vacant-land evidence. Vacant parcels without a conventional situs
need an identical reviewed `LEGAL_REFERENCE` in the GIS, FDOR, and sale extracts. Separate
record provenance is preserved. The owner checks the legal records before approving for review.

Sales require `GEOID`, `FDOR_CODE`, `PARCEL_ID`, `LISTING_ID`, `EVENT_ID`, `STATUS`, `AVAILABLE`,
and a record-specific official `EVIDENCE_URL`. Use the same event ID when a date or price changes.
Supported statuses are scheduled, available, postponed, canceled, sold, and expired. Include
`SITUS_ADDRESS`, `LEGAL_REFERENCE`, `AUCTION_AT`, `DEADLINE`, `ASKING_PRICE`, `OPENING_BID`,
or `MINIMUM_BID` when the official record provides them. Timestamps require a UTC offset.
Availability is an explicit source assertion and must be checked against the current official notice.
Test fixtures are barred from preview upload and approval. Keep protected ownership data outside
these extracts.

```sh
python3 tools/florida-land/prepare.py sample.csv /tmp/ppa-local-land \
  --source fdor-nal --format csv --geoid 12086 --retrieved-at 2026-11-22T12:00:00Z --fixture
node tools/florida-land/import.mjs /tmp/ppa-local-land/batch-00001.json /tmp/ppa-land-checkpoint.json
```

Use a fresh batch output directory for each new source edition. The same batch can be resumed or
replayed without duplicate publication or repeated consumption. Use one process per local checkpoint.
The preview uses atomic version checks when owners import or approve concurrently. Each county has a
4 MiB private checkpoint ceiling for small pilots. Larger volumes require a partitioned storage
design before approval. CSV streams through bounded batch generation. GeoJSON and ArcGIS JSON
accept files up to 8 MiB. Shapefile conversion requires GDAL plus local .shp, .shx, .dbf, and .prj
files. Use the approved schema and account for the DBF field-name limit when preparing extracts.
The importer accepts single-ring WGS84 polygons only. Multipart and holed polygons remain review items.

## Preview and publication

Open County Operations in PR #454, choose a Florida county, and expand **Unified Land Discovery**.
Upload only an approved, real local batch when operations are authorized. A changed sale or parcel
evidence revision requires a fresh review. Eligibility remains subject to the Florida registry's
county-specific identity evidence and existing pilot blockers. A timeout or unavailable provider
requires a new, authorized acquisition outside this offline importer. No provider requests or quota
reservations are issued by this workflow. Interrupted offline work is handled through its import receipt.

The county publisher still requires separate live verification, exact owner authorization, and
an independently reserved recheck. No listing is exposed on any map from this workflow. The existing
48-hour release rule remains in the current research feed. A future sale-offer release contract needs
the same access policy and a separate permission review because the current release helper serves
research-only records. Flood and wetlands filters need independently verified source evidence.
