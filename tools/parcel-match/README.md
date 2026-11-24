# Parcel matching (owner-approved map positions)

Matches a dataset's parcels to official public GIS parcel records and writes an audit document that the owner
dashboard imports for approval. Free public ArcGIS layers only. No keys, no paid services, no AI.

## Run

    node tools/parcel-match/run.mjs --dataset NY-city-of-rochester
    node tools/parcel-match/run.mjs --dataset NY-city-of-rochester --offline   # from cached responses, no requests

Raw responses are cached in `tools/parcel-match/cache/` (git-ignored). Output:
`netlify/lib/data/parcel-matches/<dataset>.json`. That folder is server-side only: it holds pending positions.

## Rules

- A record matches an official parcel when its parcel number (SBL) and its verified street address agree:
  the house number is inside the parcel's range, the street matches after suffix normalization, and ZIP agrees
  when both have one.
- A position comes only from the official polygon: a point inside it, and its boundary when the parcel has one part.
- A parcel number that exists with a different address is a conflict. It stays pending and is never matched elsewhere.
- Two official sources that disagree by more than 150 m hold the record as a source conflict.
- Records that do not match stay pending, with the reason and any candidate parcels at the same address as leads only.

## Adding a county

1. Add the official layer to `netlify/lib/gis-sources.mjs`: its URL, the parcel-number field, a function that reads the
   address, the bounding box, the evidence link, the data date, the usage terms, and any required disclaimer text.
2. Add a dataset check if the county's list has known text defects (`ADDRESS_ARTIFACT_FIXES`).
3. Run the tool. Read the summary and the pending list before importing.
4. Add the output file to `netlify/lib/parcel-matches-registry.mjs`, then import and approve in the owner dashboard.
