# Owner Brain: controlled manual tests (preview only)

These checks need a signed-in owner account on the **preview** site. They were not run by the automated suite, because the preview's credentials and owner session are not available to the test environment. Do not run them on production. Keep every test on a test parcel from a pending case. Never paste an API key into a message, screenshot or note.

## Before you start
1. Open the owner dashboard on the preview and find **NVIDIA consolidation**.
   - "Key configured (environment)" or "Key configured (saved in admin setup)": the key is present on the server. Its value is never shown.
   - "No key configured. Nothing will be sent.": stop here. Add the key on the admin setup page. Nothing is sent without a key.
2. Note today's count in "Used today N of 3". The free allowance allows three owner-triggered runs per UTC day.

## Test 1: NVIDIA consolidation (one run, uses one of three daily runs)
1. Press **Run NVIDIA consolidation** and confirm.
2. Expected: a receipt appears with "Sent: N helper results (official-gis-worker …, validator …)", the model name, and the conflict and proposal counts. Every proposal names its parcel and cites its source references.
3. Expected: "Used today" increases by one. The key does not appear anywhere on the page.
4. Press the button again until the limit is reached. The fourth run must be refused with "Daily NVIDIA consolidation limit reached. Nothing was sent."

## Test 2: approve a pending correction (Pro first)
1. In **Owner approval queue**, choose a pending case. Open the evidence link and check the official record yourself.
2. Tick "I personally checked the official county record." Write a note of at least 15 characters. Keep the release option "Pro first, Free after 48 hours". Press **Approve**.
3. Expected message: "Published: Pro now; Free after 48 hours."
4. Open `https://<preview>/.netlify/functions/brain-map-county?dataset=MI-wayne` in a private window (signed out). The parcel must **not** appear.
5. Open the same URL signed in with a Pro account. The parcel must appear, and the response must show `"access":"pro"`.
6. After 48 hours from the approval time, the signed-out request must show the parcel too.

## Test 3: critical release
1. On another pending case, choose "Critical: release to everyone now". Enter a reason of at least 40 characters. Tick the critical confirmation. Press **Approve**.
2. Expected: the signed-out request in step 4 of Test 2 shows the parcel immediately.

## Test 4: reject a pending case
1. Press **Reject** on a pending case with a note of at least 15 characters.
2. Expected: "Rejected. Nothing was published." The case cannot be approved afterwards.

## Test 5: withdraw a public correction
1. In the queue, find a case marked **already public** and press **Withdraw from public map**. Confirm.
2. Expected: "Rejected. The correction was removed from the public map." The parcel disappears from the signed-out and the owner views of the feed.

Research releases (lien, land, tax deed and property updates) can be withdrawn through the research-updates API by a signed-in owner. There is no dashboard button for this yet. The withdrawal removes the item for every viewer.

## Test 6: shared GIS budget
1. Approve a case when the shared official GIS budget is used up.
2. Expected: "Approved. Publication waits for the shared official GIS budget." The correction stays out of the public feed.
3. After the UTC day resets, press **Publish approved corrections** and confirm. Expected: "All waiting corrections are published." or a clear count of what still waits.

## Test 7: helper APIs
- **Photon** (free, no key): on a machine with internet access, run `node tests/manual/photon-live-check.mjs` from the repository root. Expect HTTP 200 and candidate coordinates. Geocoder results are unverified candidates, not parcel boundaries.
- **Geoapify**: needs a key. Check the Geoapify status panel. "provider_limited" or "provider_error" is an honest result if the key or allowance is missing.

## Test 8: the activity log
1. Open `/owner/brain/activity/`.
2. Expected: eight agent cards, each with a text state (ACTIVE, IDLE, COMPLETED, FAILED, QUOTA LIMITED or NOT CONNECTED). Gemini, OpenAI and Groq show NOT CONNECTED, because they are not part of the helper pipeline.
3. After Test 1, a "HELPER → NVIDIA · N ITEMS" signal appears within about 20 seconds, or on **Refresh activity**. NVIDIA shows COMPLETED.
4. Recorded events shown on first load do not replay as new animation. Only events that arrive after the page loaded animate.

## Recording results
For each test, write the date (UTC), the preview URL, the outcome in the words above, and whether it matched the expected result. Note any difference exactly. Do not include keys, tokens or session cookies.
