# Owner Brain: controlled manual tests (preview only)

These checks need a signed-in owner account on the **preview** site. They were not run by the automated suite, because the preview's credentials and owner session are not available to the test environment. Do not run them on production. Keep every test on a test parcel from a pending case. Never paste an API key into a message, screenshot or note.

## Before you start
1. Open the owner dashboard on the preview and find **NVIDIA consolidation**.
   - "Key configured (environment)" or "Key configured (saved in admin setup)": the key is present on the server. Its value is never shown.
   - "No key configured. Nothing will be sent.": stop here. Add the key on the admin setup page. Nothing is sent without a key.
2. Note today's count in "Used today N of 3". The free allowance allows three owner-triggered runs per UTC day.

## Test 1: NVIDIA consolidation (one run, uses one of three daily runs)
1. Press **Run NVIDIA consolidation** and confirm.
2. Under each proposal, expect a "Sources:" line (H-refs and their sources, taken from the helper results, not from the model) and either "Official location: …" or "No official location in the sources". A proposal that states a number its sources do not contain is rejected and counted under "citation(s) rejected". If NVIDIA stops before finishing, the receipt shows "Incomplete answer: nothing was proposed from it."
3. Expected: a receipt appears with "Sent: N helper results (official-gis-worker …, validator …)", the model name, and the conflict and proposal counts. Every proposal names its parcel and cites its source references.
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

## Preview links (Deploy Preview of PR #454)
- Owner dashboard: https://deploy-preview-454--pricepocketasset.netlify.app/owner/brain/
- Sign in: https://deploy-preview-454--pricepocketasset.netlify.app/login/ (use your owner account; sign out later to test the Free view)
- Map, Palm Beach test county: https://deploy-preview-454--pricepocketasset.netlify.app/map/?c=FL-palm-beach
- Map feed for the test county (shows what the signed-in viewer receives): https://deploy-preview-454--pricepocketasset.netlify.app/.netlify/functions/brain-map-records?state=FL&county=Palm%20Beach
- Key manager: https://deploy-preview-454--pricepocketasset.netlify.app/owner/keys/

## Before any write: confirm the preview store
1. Open the owner dashboard and scroll to **Property intake · owner approval**.
2. Under the paste box, the green line must read: "Storage: isolated preview store. Approvals, withdrawals and test writes here never reach the production site." If it reads "Storage: PRODUCTION", stop: you are not on the preview.
3. Shared on purpose: the NVIDIA, Geoapify and Wayne GIS daily allowance counters (one allowance for the account), sign-in sessions, and Pro download history (the export allowance). Everything else these tests write stays in the preview store.

## Test 9: property intake becomes a real map record
Use only the synthetic parcels below (TEST-PB-…), never a production parcel.
1. In **Property intake · owner approval**, paste:
   `[{"kind":"new_property","category":"land_bank","origin":"owner-manual","state":"FL","county":"Palm Beach","parcelId":"TEST-PB-0001","title":"Manual test item","description":"Owner manual test of the intake workflow. Not a real parcel.","address":"1 Test Way, West Palm Beach FL","amount":1000,"longitude":-80.0534,"latitude":26.7153},{"kind":"new_property","category":"land_bank","origin":"owner-manual","state":"FL","county":"Palm Beach","parcelId":"TEST-PB-0002","title":"Unlocated test item","description":"Owner manual test of an unlocated property. Not a real parcel.","address":"2 Test Way, West Palm Beach FL"}]`
2. Tick "I understand these items stay private…" and press **Save for verification**. Expected: "Created 2". Both cards read **Awaiting verification**. The map feed link shows `"records":[]`.
3. On TEST-PB-0001 press **Verify this item**. Enter `https://discover.pbcgov.org/` as the official source, notes of 15+ characters, tick the two checks **and** "The coordinates match the official county GIS", then press **Save verification**.
4. On TEST-PB-0002 press **Verify this item**, do the same but leave the coordinates check unticked (it has no coordinates, so the box is hidden).
5. On TEST-PB-0001 press **Approve…**, keep "Pro first, Free after 48 hours", tick "I personally checked…", press **Approve and release**. Expected: "Released to Pro now. Free and anonymous viewers see it after 48 hours."
6. On TEST-PB-0002 press **Approve…**, choose "Critical: release to everyone now", write a 40+ character reason, tick both boxes, press **Approve and release**. Expected: "Released to everyone now."
7. Signed in as owner, open the map link. Search for "Test Way". Expected: both parcels are listed in Palm Beach. TEST-PB-0001 has a marker at its point; TEST-PB-0002 opens with "Location not verified yet. Listed without a map position", and no marker.
8. In a private window (signed out), open the map link. Expected: only TEST-PB-0002 (critical) is listed; TEST-PB-0001 appears 48 hours after step 5.
9. Correction: paste `[{"kind":"new_property","category":"land_bank","origin":"owner-manual","state":"FL","county":"Palm Beach","parcelId":"TEST-PB-0001","title":"Corrected amount","description":"Correction of the amount on the manual test item.","amount":900}]`, verify it, and approve it as critical. Expected on the map: still one TEST-PB-0001, now with amount 900 (no second record).
10. Reject path: paste a third item with `"parcelId":"TEST-PB-0003"`, verify it, press **Approve…** then **Reject…**, write 15+ characters, press **Reject: nothing is published**. Expected: "Rejected. Nothing was published." It never appears on the map.
11. Pro download: signed in as owner on the map, open TEST-PB-0001, tick its select box, and use **Downloads** to preview the file. Expected: the row shows amount 900. (This uses the shared export history, not an allowance, for the owner.)

## Test 10: withdrawal (dialog, reason, audit, every viewer)
1. In **Research releases · withdraw**, find "Corrected amount" (TEST-PB-0001). Press **Withdraw from every viewer…**.
2. Press **Withdraw now** with no reason. Expected: "Write at least 15 characters explaining the withdrawal." Nothing is sent.
3. Write 15+ characters and press **Withdraw now**. Expected: the dialog closes; "Withdrawn at <time>. It no longer appears for any viewer."; the card shows the reason and its audit history lists "withdrawn".
4. Reload the map. Expected: TEST-PB-0001 shows the earlier amount 1000 again (the correction is withdrawn, the first approval stands).
5. Withdraw "Manual test item" (the first TEST-PB-0001 approval) the same way. Reload the map: TEST-PB-0001 is gone for owner, Pro, Free and signed out. Its intake card reads **Withdrawn**.

## Test 11: live checks (preview only; one request per press)
1. In **Live checks · preview only** press **Refresh availability**. Four cards appear; each says "Configured on the server. The value is never shown." or names what is missing.
2. **NVIDIA chat check** → **Run once…** → OK in the browser prompt. Expected: "OK: NVIDIA answered with model <name>." If NVIDIA refused the configured model, the message also says which model and status, and that a fallback was used. A failure names its source: "NVIDIA returned HTTP <status>" is NVIDIA's own answer; "NVIDIA responded (HTTP 200) but returned no visible text" means NVIDIA answered and our backend rejected the empty reply. Uses one of the 3 daily NVIDIA runs. If the key is missing the button is greyed out.
3. **Geoapify geocode check** → **Run once…** → OK. Expected: "OK: Geoapify answered with N result(s)."
4. **Wayne County GIS layer check** → **Run once…** → OK. Expected: "OK: Wayne County GIS answered layer metadata. No parcel was queried."
5. **Intake round trip** → **Run once…** → OK. Expected: "OK: Round trip: submitted, verified, approved Pro first…, then withdrawn. Stored in the preview store only." A `live-check` item appears in the intake list as **Withdrawn**.

## Test 12: key availability (names only)
1. Open the key manager link. Check only whether `GEOAPIFY_API_KEY` is "set". Do not edit, copy or record any value or hint.
2. The NVIDIA key status is in the dashboard's **NVIDIA consolidation** panel ("Key configured (environment)" or "(saved in admin setup)"). The Wayne GIS check needs no key.
3. Record only the names that are set. Test 11 should match.

## Test 13: Rochester parcel positions (import, batch approval, map)
Preview only. Every step below writes to the isolated preview store. No step queries an outside service.
1. Open the owner dashboard and scroll to **Parcel matches · official positions**. Expected summary: "City of Rochester, NY: 191 records · 191 matched to an official parcel (191 with a boundary) · 0 pending · 0 already in the approval queue". The sources line names the City of Rochester Tax Parcels (data 2025) and its terms.
2. Press **Import matched records for review…**, then OK. Expected: "Imported 191 (191 ready for approval, 0 pending investigation, 0 already present)." Pressing it again must report 191 already present and import nothing new.
3. Under **Property intake · owner approval**, press **Select all ready (191)**. The counter reads "191 verified, located records ready · 191 selected". Open any card's "official source" link: it is the City's own parcel record for that parcel number.
4. Press **Approve selected…**, then OK. The dashboard sends four requests of up to 50. Expected: "Approved 191 of 191. Batch batch-…". Each card now reads Released, and its audit history has one "approved" entry with the batch id.
5. Map, signed in as a Pro account: https://deploy-preview-454--pricepocketasset.netlify.app/map/?c=NY-city-of-rochester . Search "Avenue A". The parcel at 363 Avenue A shows its marker and boundary, and its details show the official spelling and, under Sources, "Owner-verified against City of Rochester Tax Parcels … modified for use from its original source, which is the official website of the City of Rochester, NY."
6. Map, signed out (private window): the same parcels should not show until 48 hours after step 4. Check again then; they should show.
7. Optional: withdraw one record from its card (Test 10). Its marker and boundary disappear from the map after a reload.

## Recording results
For each test, write the date (UTC), the preview URL, the outcome in the words above, and whether it matched the expected result. Note any difference exactly. Do not include keys, tokens or session cookies.
