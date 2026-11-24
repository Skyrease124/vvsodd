# Parcel matching (owner-approved map positions)

Matches a dataset's parcels to official public GIS parcel records and writes an audit document that the owner
dashboard imports for approval. Free public ArcGIS layers only. No keys, no paid services, no AI.

## Run

    node tools/parcel-match/run.mjs --dataset NY-city-of-rochester
    node tools/parcel-match/run.mjs --dataset NY-city-of-rochester --offline   # from cached responses, no requests
    node tools/parcel-match/run.mjs --all [--offline]    every dataset that has an official source configured
    node tools/parcel-match/run.mjs --report             summary of the audits on disk; no requests, no writes

Raw responses are cached in `tools/parcel-match/cache/` (git-ignored). Output:
`netlify/lib/data/parcel-matches/<dataset>.json`. That folder is server-side only: it holds pending positions.

A rerun with `--offline` from the cache reproduces the committed Rochester audit exactly, except `generatedAt`. Check
that before committing a change to the matcher.

## Rules

- A record matches an official parcel when its parcel number and its verified street address agree: the house number
  is inside the parcel's range, the street matches after suffix normalization, and the ZIP agrees when both have one.
- A position comes only from the official polygon: a point inside it, and its boundary when the parcel has one part.
- A parcel number that exists with a different address is a conflict. It stays pending and is never matched elsewhere.
- Two official sources that disagree by more than 150 m hold the record as a source conflict.
- Records that do not match stay pending, with the reason. Candidate parcels at the same address are leads only.

## Identifiers

Each source says how its parcel numbers are compared (`normalize` in `netlify/lib/gis-sources.mjs`):

- `ny-sbl` (default): New York section-block-lot numbers. "120.74-2-13" and "0120.74-02-013" are one parcel. A value
  with trailing text ("091.75-2-25./HOME") is matched on its SBL and the verified address, with a note on the record.
- `alphanumeric`: letters and digits only, in upper case. "12-34/5a" and "12.34/5A" are one parcel.
- `exact`: the text as written, trimmed. Case matters.

## Adding a county

1. Add an entry to `netlify/lib/gis-sources.mjs` (the comment above `SOURCES` lists the fields): the layer URL, the
   `parcelField`, `normalize`, `bbox`, `covers`, and `fields` naming the layer's address and official attributes.
   Entries that need custom logic can supply `toAddress`, `official` and `evidence` functions instead.
2. Give the layer's `terms` and its required `disclaimer`. The owner dashboard shows them with the audit.
3. Add a dataset check if the county's list has known text defects (`ADDRESS_ARTIFACT_FIXES`).
4. Run the tool for the dataset. Read the summary and the pending list before importing.
5. Add the output file to `netlify/lib/parcel-matches-registry.mjs`, then import and approve in the owner dashboard.

`tests/parcel-match-county.test.mjs` shows a fictional county configured and checked without any network access.

## Corrections to list text

`ADDRESS_ARTIFACT_FIXES` reverses a known list defect for matching only. Where the official address differs from the
list text, the audit keeps the list text in `addressAsListed` and the official text in `address`. The Rochester
corrections are described in `tools/rochester-ny/README.md`: they reach the public files only after the Pro early-access
window has ended.
