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

Research releases (lien, land, tax deed and property updates) can be withdrawn from the dashboard. See Test 10.

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

## Test 9: property intake (verify, approve, reject, critical)
Every new property fact waits in **Property intake · owner approval** until you verify and approve it. Use only the synthetic test parcel below, never a production parcel.
1. Paste this JSON into the intake box, tick "I understand these items stay private until they are verified and approved", and press **Save for verification**:
   `[{"kind":"new_property","origin":"owner-manual","state":"FL","county":"Palm Beach","parcelId":"TEST-PB-0001","title":"Manual test item","description":"Owner manual test of the intake workflow. Not a real parcel."}]`
   Expected: "Created 1". The item shows **Awaiting verification**. Signed out, `/.netlify/functions/research-updates` lists nothing for it.
2. Press **Verify this item**. Enter an `http://` source first: expected "The official source must start with https://". Then enter an `https://` official link, notes of at least 15 characters, tick both checks, press **Save verification**. Expected: "Verified. Next: approve it or reject it."
3. Press **Approve…**, keep "Pro first, Free after 48 hours", tick "I personally checked the official record", press **Approve and release**. Expected: "Released to Pro now. Free and anonymous viewers see it after 48 hours." Then check `/.netlify/functions/research-updates?type=property`: signed out, the item is absent; signed in as Pro, it is present with `"access":"pro"`; after 48 hours from the approval time, signed out, it is present.
4. Reject path: submit a second synthetic item (change `TEST-PB-0001` to `TEST-PB-0002`), verify it, press **Approve…** then **Reject…**, write at least 15 characters, press **Reject: nothing is published**. Expected: "Rejected. Nothing was published." The rejected item has no approve button.
5. Critical path (test item only): on a third synthetic item, choose "Critical: release to everyone now". The reason box and the critical confirmation appear. Write a reason under 40 characters: expected "A critical release needs the confirmation and a reason of at least 40 characters." With 40 or more characters and the confirmation ticked, press **Approve and release**. Expected: "Released to everyone now." Signed out, the item is present at once.
6. Refused batches: paste a batch with one bad item (for example `"parcelId":"x"`). Expected: the whole batch is refused and no item appears.

## Test 10: research withdrawal (dialog, reason, audit, every viewer)
1. In **Research releases · withdraw**, find the item released in Test 9 step 3. Press **Withdraw from every viewer…**. A confirmation dialog opens with the item title.
2. Press **Withdraw now** with an empty reason. Expected: "Write at least 15 characters explaining the withdrawal." Nothing is sent.
3. Write a reason of at least 15 characters and press **Withdraw now**. Expected: the dialog closes, and the status reads "Withdrawn at <time>. It no longer appears for any viewer." The card now shows "Withdrawn <time> · reason: …" and its audit history lists a withdrawn entry.
4. Check every viewer: `/.netlify/functions/research-updates?type=property` returns no item signed out, signed in as Free, signed in as Pro, or signed in as owner. On the preview map, reload the test parcel's view; if the item had appeared as a pin, it is gone.
5. The withdraw button is no longer shown for that item. The intake card for the same item shows **Withdrawn**.

## Test 11: live checks (preview only, one request each, you press each one)
This panel appears only on the preview. Each run asks for confirmation and sends one request.
1. Press **Refresh availability**. Expected: four cards: NVIDIA chat check, Geoapify geocode check, Wayne County GIS layer check, Intake round trip. Each says "Configured on the server. The value is never shown." or names what is missing. No key value appears anywhere on the page.
2. **NVIDIA**: if "NVIDIA key is not configured", the button stays disabled and nothing is sent. Otherwise press **Run once…**. Expected: "OK: NVIDIA answered one request with an 8-token limit." Used today rises by one, and the NVIDIA panel's "Used today" count rises too (it shares the 3 daily runs).
3. **Geoapify**: press **Run once…**. Expected: "OK: Geoapify answered with N result(s)." If the key is missing the button is disabled. If the result is `Failed: Geoapify returned HTTP 401 or 403`, check the key and its restrictions in the key manager (Test 12).
4. **Wayne County GIS layer check**: press **Run once…**. Expected: "OK: Wayne County GIS answered layer metadata. No parcel was queried." If it says "Allowance used up", the shared Wayne GIS daily budget is spent; wait for the UTC day to reset.
5. **Intake round trip**: press **Run once…**. Expected: "OK: Round trip: submitted, verified, approved Pro first, checked the Pro and Free timing, then withdrawn. Stored in the preview store only." A new item labelled `live-check` appears in the intake list as **Withdrawn**. Limit: three per day.
6. Record each outcome word. Do not run a check more times than you need: each press uses real allowance.

## Test 12: key availability in the API Key Manager (names only)
1. Open `/owner/keys/`. Each key shows "set" or "not set" and a short hint of its last characters.
2. Check only the status of `GEOAPIFY_API_KEY` here. The NVIDIA key is checked in the **NVIDIA consolidation** panel on the dashboard ("Key configured (environment)" or "(saved in admin setup)"). The Wayne County GIS check needs no key. Do not edit, replace, copy, or record any value or hint.
3. If a key is not set and you want that live check, add the key yourself in the key manager. Never paste it into chat, a note or a screenshot.
4. Record only which names are set. Expected: the live checks in Test 11 match these statuses (a key that is set can still fail: that is a provider result, not a missing key).

## Recording results
For each test, write the date (UTC), the preview URL, the outcome in the words above, and whether it matched the expected result. Note any difference exactly. Do not include keys, tokens or session cookies.
