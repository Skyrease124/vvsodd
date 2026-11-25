# City of Rochester list: builder and address corrections

## The list builder (`build.py`)

`build.py` writes `kinvest-liens/liens/states/liens-rochester.js` from the City's foreclosure auction list (the PDF is
not in the repository). Before this fix it turned "AVENUE", "AVERILL" and "AVIS" into "Aveenue", "Aveerill" and "Aveis",
because it replaced the text " Av" wherever it appeared. It now expands only the whole word "Av" (to "Ave") and "Pk"
(to "Park"). The output for every other address is unchanged.

Test: `python3 tools/rochester-ny/test_build.py`.

**Warning.** Running the builder overwrites the public list. Do not commit a rebuilt `liens-rochester.js` before the
corrections below have been applied, because the corrected spelling is official data for records still in their Pro
early-access window.

## The corrections (`corrections.mjs`, `address-corrections.json`)

The manifest lists the 11 parcels whose list text differs from the official City address. Each entry gives the parcel
number, the listed text, the corrected text, and the official parcel ID and address from the City layer, as recorded in
the matches audit (`netlify/lib/data/parcel-matches/NY-city-of-rochester.json`). Parcel numbers and positions do not
change.

The manifest is generated from the audit: `node tools/rochester-ny/corrections.mjs --write`. It is refused once the
corrections have been applied.

## Applying them to the public files (`apply-address-corrections.mjs`)

Owner-approved records reach free visitors 48 hours after they reach Pro members. The public list and map data are
changed only after that window has ended for the approved batch.

1. Find the end of the window. It is the latest `freeReleaseAt` among the Rochester releases. The owner research feed
   (`research-updates`, GET with `scope=owner`) lists each release with its `freeReleaseAt`.
2. Dry run. This writes nothing and lists the 22 changes (11 parcels, in two files):

       node tools/rochester-ny/apply-address-corrections.mjs --not-before <end of window, ISO 8601>

3. Apply:

       node tools/rochester-ny/apply-address-corrections.mjs --not-before <end of window, ISO 8601> --apply

The script refuses to apply before the time you give, refuses a manifest that differs from the audit, and refuses a
record that is not exactly as expected. It changes only the 11 address fields, leaves every other byte of both files as
it was, regenerates `netlify/lib/data/static-map-baseline.json`, and records `appliedAt` in the manifest. It can be run
once. Then commit the result and check `tests/publish_boundary.test.mjs` and `tests/location-coverage.test.mjs`.

Neither step changes the matches audit, the approvals, or the release history.
