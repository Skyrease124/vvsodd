# Delinquent tax records (not a sale list)
Build: `node tools/delinquent/build.mjs <file.csv> --received YYYY-MM-DD [--asof YYYY-MM-DD]`. The CSV is not stored in the repo. Owner names and mailing addresses are never read into the output.
Parcel rows: `netlify/private/delinquent/*.json` (members only, via `netlify/functions/delinquent.mjs`). Aggregates: `kinvest-liens/liens/delinquent/*-summary.json` (public).
Tests: `node netlify/tests/delinquent.test.mjs`, `node tools/delinquent/browser.mjs`.
Rules: never describe a row as for sale or available; show the city's stated total; say when the export date is unknown.
