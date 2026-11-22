# Florida GIS registry

`directory.original.csv` preserves the uploaded data. `directory.corrected.csv` stores three-character county FIPS and five-character GEOIDs. `directory.audit.json` records each altered input field, with its old value and citation.

`official-identifiers.json` is the 2026-11-22 snapshot extracted from the [Census Florida county code file](https://www2.census.gov/geo/docs/reference/codes2020/cou/st12_fl_cou2020.txt), Section I of the [FDOR 2025 NAL guide](https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/User%20Guides/2025%20Users%20guide%20and%20quick%20reference/2025_NAL_SDF_NAP_Users_Guide.pdf) and the 67 PALink values used by the [FDOR Local Officials directory](https://floridarevenue.com/property/Pages/LocalOfficials.aspx). Directory links were compared to authoritative listings. Their individual live availability was not polled.

Regenerate the corrected CSV, audit, and `netlify/lib/data/florida-gis-registry.json` with `python3 tools/florida-gis/build.py`. CI checks deterministic regeneration and rejects malformed or duplicate identifiers.

FDOR county numbers are preserved because the NAL guide documents the numeric `CO_NO` field. Census county FIPS and GEOIDs are separate fields. Public layer metadata was checked for FloridaGIO and Santa Rosa ParcelsOpenData. FloridaGIO advertises query and extraction with annual assessment data, and county-specific parcel mappings still need validation. Santa Rosa's alternate layer declares `ParcelDisp` and `Addr1` through `Addr3`; the address fields are not established as situs and the alternate cannot dispatch. No parcel requests, downloads, or publication were performed.

County Operations uses existing map dataset IDs. Directory-only entries are visible to owners and cannot dispatch. The existing Florida pilot definitions reuse the shared source schema when applicable and remain separately gated. Miami-Dade retains its independent county source. The registry does not change public map feeds, saved pilot state or scheduling.
