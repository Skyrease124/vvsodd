# PricePocketAsset — PR #454 single source of truth / Codex handoff

Updated: 2026-11-21. Primary development branch: `integration/brain-map-452-453-preserve` (PR #454). Do not resume future feature work from PR #452 or #453. Both are reference branches only. PR #454 is a draft, NOT a completed or production-approved release.

## Why PR #454 exists

PR #452 (`brain-to-map-pipeline`) contains the broader Brain-to-Map system, the owner **County Agent Progress** percentage bar (which previously displayed approximately 0.12% for Wayne), the NVIDIA Pulse Reactor agent activity log and flowing visuals, mapping/Workshop/MapTiler integration, and the larger test suite.
PR #453 (`release/wayne-autonomy-pilot`) contains newer Wayne test-batch UI, preview queue isolation improvements, explicit publisher charge-before-GIS lookup, and a publisher that cannot be independently scheduled/invoked.
PR #454 combines these toward a single master branch. Do not make PR #455 just to continue this work.

## Confirmed committed to PR #454

- Based on PR #452, preserving the county-progress endpoint `netlify/functions/owner-brain-county-progress.mjs`, `kinvest-liens/owner/pipeline.js`, its 20-second refreshed two-decimal completion indicator, and the PR #452 tests.
- Preserves `kinvest-liens/owner/brain/activity/index.html` and `netlify/functions/owner-brain-activity.mjs` and the NVIDIA Pulse Reactor dashboard link.
- Ports the **Run Wayne Test Batch** preview-only owner control and real batch result display into `kinvest-liens/owner/brain/index.html` without overwriting PR #452 dashboard.
- Ports PR #453's guarded `owner-brain-wayne-run.mjs` and `brain-map-publish-auto.mjs`, including internal-only publisher access, no independent publisher schedule, and charging every publisher GIS request against the Wayne 30/day limit before dispatch.
- Keeps PR #452's queue implementation and its preview response fields, and keeps PR #452's more recent parcel-map source instead of overwriting it with the older PR #453 variant.
- Uses dedicated preview Blob namespace `ppa-brain-preview-integration`. DO NOT reuse PR #452 (`ppa-brain-preview-pr452`), PR #453 (`ppa-brain-preview-pr453`), or production Blob data. Seeded scanner pause/queue inheritance was removed for integration previews.
- Retains existing Wayne scheduler, owner-auth checks, retry review, map merge scripts, county overlay, and assorted integration modules from PR #452.
- Adds `kinvest-liens/tests/brain-map-consolidation.test.mjs`, updates the existing scheduled-worker publisher assertion, and adds the consolidation test to `.github/workflows/validate-brain-map.yml` (CI has not yet been observed passing for this head commit).

## Validation status — do not inflate

Code is committed; **NOT certified complete**. CI and deploy preview status are not yet confirmed passing for this latest PR #454 head. Do not claim county percentages, authenticated owner UI, first GIS batch, or three-map publication visually tested. GitHub PR mergeability is not proof of readiness.
Previously observed in isolated PR #453 user screenshots: Wayne cursor 3, verified/published 3, then a timeout/retry with daily worker GIS usage 10/30. This is **not** proof that current PR #454 storage has the same counts; its store is intentionally different. PR #452 earlier showed approximately 9 verified corrections, but current PR #452 Blob state has not been independently read and validated. Preserve both environments.

## Required remaining work IN PR #454, in order

1. Run all existing PR #452 tests and new consolidation test on current PR #454 HEAD, including Node 22 and `--experimental-vm-modules` where needed. Fix failing tests in this SAME BRANCH. Confirm GitHub Actions check results.
2. Audit any remaining differences between PR #454 and PR #453, especially `kinvest-liens/map/parcel-map.js`, queue, auth preview wrapper, publisher, worker, and schedule. Preserve any intentional newer PR #452 functionality; selectively port a missing PR #453 behavior rather than wholesale overwriting PR #452 source. Confirm no missing owner log, county progress, map displays or admin controls.
3. Validate deploy-preview-454 and `/owner/brain/`, `/owner/brain/activity/`, county-progress bar/API, owner-only Wayne Test Batch UI, retry controls, and all three parcel/Workshop/MapTiler views. Use authenticated browser checks where authorized, never fabricate them.
4. Audit GIS request counting across direct worker and internal publisher under concurrency, retries, and failures; ensure limit of 30 official GIS requests/day cannot be bypassed by racing calls. Verify preview and production isolation, source verification, rate limits, lock/retry/cursor consistency, proper progress numerator/denominator, and absence of duplicate publication.
5. Confirm real persistent data in each preview store read-only before any migration; do not infer saved values from screenshots or code. Test one small real official GIS batch only after preview controls and quotas are verified, with owner approval as required.
6. Confirm all three map consumers reflect saved verified official polygons and do not confuse geocoder points with verified boundaries. Ensure county % and activity log report real backing state, not animations presented as factual work.
7. Keep 24/7 production schedule **OFF**, and do not merge, reset Blob data, modify production or deploy production without explicit owner approval.

## Handoff rule

All subsequent coding/analysis must begin by inspecting **PR #454 HEAD**, and must commit further work to `integration/brain-map-452-453-preserve` (same PR #454). PR #452 and #453 are historical comparisons only. Report which tests truly passed, which UI interactions were actually checked, which files changed, what remains unverified, and any production blockers. Avoid unnecessary Netlify builds/credits. There is **no green-light for production** yet.

## 2026-11-21 preview discovery / CI update

- GitHub Actions run **44963263868** completed **SUCCESS** on head `e310488c1a508ee6ea3ed8b6f9a626ef65eff01b` before this note. All 17 Node test steps passed, including county progress, activity log, Wayne worker, internal publishing, isolated preview and MapTiler contract tests. This verifies automated simulations and static contracts, not live site UI.
- PR #454 originally targeted `brain-to-map-pipeline`, which Netlify did not show in its Deploy Previews; its base was changed to `claude/engineering-workspace` (production *branch*, NOT production deployment), leaving PR **DRAFT** to enable Netlify to discover the isolated #454 Deploy Preview. Never merge PR #454 without explicit owner approval.
- Netlify's latest five deployments at inspection were all PR #453, so **PR #454 preview has NOT yet been confirmed deployed**. Check for an actual #454 Netlify deployment before sharing a working preview link.
- This handoff commit also prompts Netlify/GitHub build hooks to refresh the PR head. Keep production scheduling OFF. Existing PR #452/#453 saved data remain separate from PR #454 preview Blob namespace.

## 2026-11-22 engineering audit

Reviewed the exact pre-fix head e3ffc7a53ac7c46f3d2ca3328de539f220e40aec in a full checkout. All PR #452 changed paths still exist in #454's diff. PR #453's dedicated workflow is superseded by the integration workflow, which runs both the scheduled and consolidation suites. File coverage establishes scope, not behavior. Keep #452 and #453 as references and leave all three preview stores intact.

- **Worker and retry state:** The old lease used a read followed by an unconditional write. The fix uses Netlify Blobs ETags at the existing worker key to acquire the lease, save progress and usage, and release ownership. Retry recovery uses the same version check to reject stale re-arms. A worker losing the lease cannot persist more usage or dispatch the charged GIS request. The SDK pin and lockfile use a version that supports conditional JSON writes and contains Netlify's conditional-write race fix.
- **Quota:** The integration branch already charges the verifier and internal publisher before dispatch. Tests now check overlapping starts, publisher denial at the cap, and concurrent re-arm. Legacy Detroit research, cross-check and manual GIS handlers still have separate budgets. A system-wide 30-call guarantee requires tracing and consolidating those dispatches, without resetting existing usage or silently disabling research.
- **Publication and progress:** The current overlay is the map's source of truth. Publication uses multiple writes for geometry, history, approvals and queue status. A failure between writes can leave metadata out of sync. Introduce record-keyed publication recovery and concurrent writer tests before claiming exactly-once delivery. County progress should reconcile each correction against the original record, including valid geometry and identity, before counting it or advancing; the fast count currently accepts a looser shape than the public feed.
- **Isolation and scheduling:** The #454 preview uses its own Brain namespace. Review legacy provider control and usage keys routed through shared account storage. The Wayne scheduler currently requires the production deploy context and explicit saved owner approval. Keep it off. Independently scheduled older research jobs still exist and require a separate production configuration review. No production requests that write state were sent.
- **Frontend and activity:** Integration CI exercises overlay merging, MapTiler, county sequencing and real activity-event construction with fixtures. The public map, owner Brain, activity and MapTiler routes returned 200 on the deployed preview. The Wayne overlay feed returned version 13 with 13 records. The owner status API returned 401 and the browser displayed the owner sign-in gate. Authenticated controls, animation, Workshop and MapTiler rendering, exact live parcel-to-polygon reconciliation, and scheduler execution remain unverified. Earlier in Cloud Browser the homepage map reported that it could not start in that browser; that observation does not identify the cause.
- **Validation:** All 17 workflow files ran locally with 90 passing tests. Tests used fixtures or mocked external services and do not constitute a fresh GIS batch. No GIS batch, storage reset, PR merge or production release was initiated.

**Release decision:** Hold production. After the integration preview builds from this commit, inspect the owner account in that preview and compare the existing parcel IDs across the public, Workshop and MapTiler views. Address the shared GIS quota and publication recovery before enabling unattended processing.

**County expansion design:** Keep Detroit as the only active official polygon connector. Define a per-county connector with a verified government source, query and units contract, strict parcel/address matcher and geometry validator. Persist a county-specific source fingerprint, cursor, quota, retry state and parcel evidence. Reconcile verified overlay records against the source to decide completion. New connectors should enter disabled, pass ambiguous/missing identity, malformed geometry, quota, retry and replay fixtures, and then pass a small read-only preview validation before activation.

## Shared Wayne GIS quota follow-up

The integration branch now reserves an atomic ticket before dispatch from the Wayne worker, its internal publisher, the automatic Detroit researcher, the cross-check job, the two manual Detroit lookups, the historical Wayne lookup and the owner preview candidate lookup. Dataset downloads and unrelated parcel products are outside this budget. Requests that time out remain charged and redirects are rejected on GIS calls. The UI reads the shared count once active, and the worker's older count is retained as historical state.

Older paths did not persist a complete daily total. To avoid opening a fresh allowance on top of uncounted activity, the first eligible GIS request in each environment records the cutover UTC date and does not dispatch. The budget opens on the following UTC day. The ledger uses the existing Brain namespace selection and does not migrate records between environments. Retire old preview builds from use during validation, since their code cannot participate in the new ledger. Legacy production schedules must stay outside overlapping deploys when this is eventually released.

Local validation passed 92 tests across 18 workflow files, including the final-slot race, UTC rollover, legacy state preservation and existing publisher quota regression. No live GIS request or batch was made. Publication replay and owner-authenticated preview validation remain separate release gates.

## Publication recovery follow-up

New Wayne publications atomically save a verified polygon with an unfinished-metadata marker. A later worker invocation completes history, approval, and queue updates from that saved record without fetching the source or charging GIS quota. Conditional writes preserve intervening changes, and history deduplicates on dataset, record, review case, and original publication timestamp. Recovery clears the marker only after those writes succeed and leaves the source cursor unchanged. The owner test control allows this recovery even when the daily GIS budget is full. Previously published polygons without a marker are left as they are.

A second quota pass routed the older three-parcel preview test and publishing preparation through the shared counter. The internal publisher still requires its existing guarded caller.

Offline tests force interruptions at history, approval, and queue writes and replay recovery concurrently. The polygon version and geometry stay fixed, one history entry remains, and GIS dispatch does not repeat. Another test exercises worker recovery with a full budget. No production release or live batch was initiated.

## Phase 3: County connector foundation

- The owner-only **County Connectors** dashboard is linked from AI Brain and reads the existing map index, a selected county's bundled dataset, and its existing verified overlay. It never calls GIS or writes storage. The coverage denominator is originally unmapped dataset records, not countywide parcels and not the connector readiness grade.
- The read-only source registry and ArcGIS query adapter validate hardcoded reviewed layer URLs, dataset and county identity, string parcel IDs (including leading zeros), exact normalized situs address, unique result and object ID, explicit WGS84 transformation, and closed, simple polygons with plausible approximate acreage. Bounds are a sanity check, not a legal county-line intersection. Holes, multipart shapes, missing situs addresses, and out-of-range geometry require review. FeatureServer and MapServer share the ArcGIS query contract; Larimer exercises MapServer and the existing Wayne FeatureServer worker remains intact. Other service protocols can be added as separate adapters.
- Larimer, Colorado, is disabled and testing-only. The county-hosted Tax Parcels layer has native EPSG:2876 and exposes PARCELNUM, LOCADDRESS and OBJECTID_1. A read-only query for already mapped dataset parcel 9524325120 returned one matching situs address, object ID 5576701 and a closed six-vertex WGS84 ring. That was a source compatibility check, not an unmapped trial or a published correction. The 2026-11-11 index lists 1,831 records and 1,790 mapped. Many unmapped records have missing situs addresses. Use unmapped records with addresses for an approved preview trial first.
- The reusable preview trial runner uses injected budget reservation and conditional storage writes. It serializes trial calls, binds progress to a source revision, holds a failing parcel through retry, and saves trial evidence separately from production and map corrections. It has no production mode, deployed invocation, scheduler, or publishing permission.
- Brain can read the catalog to identify unsupported datasets and record research leads. Automated discovery, live trial invocation, owner approval UI, durable quota provisioning for new counties, activation, publication, and new Reactor event emission remain future work. Existing Wayne quota and activity reporting are unchanged. Any future publisher must use the existing verified overlay, history, and recovery contract so all three maps continue to agree.

### Larimer preview trial gate

The prior connector dashboard deployment returned HTTP 200 and its county data API returned 401 without an owner session. The county's Tax Parcels layer metadata returned HTTP 200 and confirmed polygon geometry, native EPSG:2876, string PARCELNUM and LOCADDRESS, and OBJECTID_1. The prior mapped sample confirmed WGS84 output. The selected unmapped records in the existing dataset are 9701400014 (741 Lindenmeier Rd), 8510310018 (5600 Mcwhinney Blvd D5692), and 8510339002 (1750 Foxtrail Dr 2). No official request for these candidates was made before verifying owner access and the deployed trial budget.

The County Connectors page now exposes a same-origin, explicitly confirmed, owner-only action on the canonical PR #454 preview host. Each invocation can send one official GIS request, with three total reservations for this trial even across retries. Evidence, cursor and review holds use distinct preview research keys. There is no map, Wayne, scheduling, or production write path. The Wayne public feed remained at 13 polygons and version 13. Private Wayne cursor, quota and history were not independently observed. After the preview deploy is ready, an owner can inspect the budget and use the trial control on each eligible request. A failed candidate stays on the review/retry checkpoint. Publication remains a separate owner-approved milestone.

Local validation includes the owner, host, origin, confirmation, and budget guards, plus existing parcel identity, geometry, retry, and concurrency fixtures.

### Larimer trial diagnostics

The first live attempt for Larimer parcel 9701400014 (741 Lindenmeier Rd, Fort Collins) reserved one of three slots and held the cursor at zero. The exact ArcGIS predicate was PARCELNUM = '9701400014', with PARCELNUM, LOCADDRESS and OBJECTID_1, geometry in EPSG:4326, and a two-result limit. The saved message came from the result-count guard before address or polygon verification. The old implementation did not retain the upstream response shape, so this attempt cannot distinguish zero rows, multiple rows, missing features, or a transfer limit.

New attempts record safe diagnostic fields alongside the existing source and reason: stage, reason code, HTTP status, numeric ArcGIS error code, result count, up to two format-checked parcel IDs, transfer-limit flag, and UTC timestamp. The owner dashboard also explains when an older attempt has no diagnostics. Raw bodies, headers, provider messages, credentials, and session data are excluded. Fixtures cover the four lookup outcomes, sensitive field exclusion, and persistence of the held cursor without another reservation. All 104 local workflow tests passed.

No live GIS request or research-state write was made. The original hold and 1/3 reservation remain intact. A new request would need separately approved recovery of this same checkpoint, or a separately obtained copy of the original provider response could resolve the old failure without a request. Do not skip to the next record.

### Final Larimer address diagnostic

The repeat exact PARCELNUM query for 9701400014 returned HTTP 200, zero rows, and no transfer-limit flag. The Treasurer import preserves 9701400014 as PARCEL NO and 0155675 separately as SCHEDULE. The reason the live layer returned zero remains unknown.

Layer metadata confirms Query capability, standardized SQL, pagination, and PARCELNUM, SCHEDNUM, LOCADDRESS, LOCCITY, and OBJECTID_1. The new owner-confirmed action uses fixed exact address and city predicates, those five fields only, a two-row limit, and no geometry. It is available only on the canonical PR #454 preview with two slots reserved and the original zero-result parcel on exhausted review. It uses an atomic reservation of the same final slot and saves sanitized evidence under its own research key. It does not release or advance the checkpoint, alter evidence, or write map corrections. A matching address is only a research lead and needs Assessor parcel history or a documented Treasurer-to-Assessor cross-reference before any identity change.

Local verification: 107 tests passed, including fixed query shape, sanitization, incomplete/ambiguous responses, explicit confirmation, preview and origin guards, concurrent attempts, and unchanged review state. No live parcel query was sent. Any live request requires separate owner confirmation in County Connectors.

### Treasurer-to-Assessor reconciliation: Glover Estate

On 2026-11-22, reviewed the saved 2026-11-11 Larimer Treasurer import, the owner-reported final official GIS address result, and the official Fort Collins planning record. The Treasurer import gives parcel 9701400014 and schedule 0155675. The final address result gives parcel 9701484001, schedule 1688587 and object 5665923 for 741 Lindenmeier Rd. Fort Collins [Glover Estate BDR240012](https://accela-aca.fcgov.com/CitizenAccess/Cap/CapDetail.aspx?Module=Planning&TabName=Planning&agencyCode=FTCOLLINS&capID1=24CAP&capID2=00000&capID3=00142) identifies the original parcel and records approval of a minor subdivision with a plat on 2024-11-13. The public summary does not identify the GIS result's parcel or schedule. No recorded plat or Assessor cross-reference linking both pairs was located. Relationship remains unresolved; the subdivision is a plausible explanation, not authorization to substitute IDs.

The owner-only County Connectors dashboard combines source-controlled, attributed research notes with the existing saved GIS diagnostic and its actual timestamp. It shows unresolved only when the stored result matches the reported identifiers and exact address. This is a read-only projection. Obtain the recorded plat or Assessor parcel history with both parcel and schedule pairs before considering an identity change. All 108 local workflow tests passed. No GIS requests, checkpoint writes, publication, or budget changes were made.

### Recorded plat and Assessor history investigation (2026-11-22 UTC)

The [official Fort Collins planning record BDR240012](https://accela-aca.fcgov.com/CitizenAccess/Cap/CapDetail.aspx?Module=Planning&TabName=Planning&agencyCode=FTCOLLINS&capID1=24CAP&capID2=00000&capID3=00142) provides the original tract's legal description. It locates the tract by offsets near the southeast corner of Section 1, Township 7, Range 69, then describes a 136-foot west, 43-foot north, 136-foot east, and 43-foot south course. This is planning evidence for parcel 9701400014, not the recorded plat, a lot count or boundary for 9701484001, or an Assessor cross-reference.

Reviewed the [Recorder Easy Access instructions](https://www.larimer.gov/clerk/recording/easy-access), its public landing page, and the [Assessor property search](https://www.larimer.gov/assessor/search). The Recorder says anonymous access does not include images. No recorded Glover Estate document, reception number, or Assessor link between the two parcel/schedule pairs was located in the public sources reviewed. This does not establish that no document exists. The owner dashboard cites these limits and retains Unresolved / Owner review. Obtain the recorded plat and the Assessor parcel history identifying which recorded lot corresponds to each parcel and schedule before classifying a successor, split, or unrelated parcel. No GIS, trial, overlay, or production action was executed.


### Reusable Treasurer-to-Assessor reconciliation queue (follow-on)
- Created `netlify/lib/brain-parcel-reconciliation.mjs`: a **read-only** county-scoped reconciliation case model and deduplicated queue. Original and candidate parcel/schedule identifiers are preserved separately, each case lists attributed source references, requested official evidence, and an explicit next review action.
- Integrated the generic queue into `owner-brain-larimer-trial.mjs` GET using the already saved Larimer address diagnostic and previous source-controlled reconciliation notes; the existing detailed Larimer report is retained. Owner-only `County Connectors` UI now shows research-only cases and missing documentary evidence.
- Address-only leads remain `unresolved_owner_review` with `publicationAllowed:false`, `identifierChangeAllowed:false`, and `automationEnabled:false`. Even a *hypothetical* correctly cross-referenced official document only progresses to `documented_link_pending_owner_review`, never automatic verification or publication.
- Adds offline regression tests for county/record identity mismatch, duplicate queue entries, missing legal evidence, exact official cross-references, and publication gating. Existing Wayne and Larimer GIS quotas, trial checkpoints, verified polygons, production scheduling and maps are not modified.
- **Remaining:** Authenticated preview UI validation; recorded Glover Estate plat/reception number and actual assessor history still not obtained. This work is a scalable case-tracking and decision-safety foundation, **not** an automated nationwide recorder/assessor search, and it does not establish any legal relationship for the Larimer candidate. Do not create alternative parcel IDs, activate processing, or publish geometry based on this queue. Continue only in PR #454.

### Phase 4: parcel history research workflow

The owner-only PR #454 research panel extends the existing identity reconciliation queue. It shows original and candidate identifiers through the queue, evidence status, recorded reference, relationship and conflicts, last attempt, reviewed source links and missing documentation. Preview pause/resume only saves queue preference. The backend explicitly reports execution disabled, rejects a run action, and exposes no scheduler or publication path.

The dormant research engine uses reviewed source descriptors, a preview gate, conditional checkpoint writes, two reservations per source, a timeout signal, retry delays, evidence deduplication and separate per-attempt receipts. The current approved registry includes Larimer Assessor, Treasurer, and Recorder; additional counties require reviewed configurations. It only supports a relationship for owner review when a recorded plat and a separate official cross-reference identify both exact parcel/schedule pairs without contradictory evidence. It never authorizes identifier changes or geometry. The Reactor reads only saved research receipts from the preview store, and retains its existing Wayne event path.

Official document collection adapters, automated document extraction, LLM calls, and a deployed execution entry point are intentionally absent. Before enabling any collection, review each source's access conditions and implement an adapter that preserves document provenance and handles restricted portals without bypassing access controls. The current owner control does not enable collection or emit a completion event.

Glover Estate remains unresolved and on owner review. Fort Collins planning reference BDR240012 identifies original parcel 9701400014 and approves a minor subdivision. The address-only GIS result 9701484001 / 1688587 is a lead. Public research did not locate the recorded plat, reception number, or Assessor split or renumbering history tying it to 9701400014 / 0155675. Authorized Recorder image access and Assessor parcel lineage are still needed. No Larimer GIS requests, paid services, or research runs occurred.

All 115 local workflow tests passed, including contradictions, missing or restricted evidence, incorrect parcel links, duplicate evidence, interrupted work, source backoff, owner guards, and real-receipt-only Reactor rendering. The existing preview public feed returned 13 Wayne corrections at version 13 and zero Larimer corrections. Public map and MapTiler pages responded; signed-in Reactor and live rendering across all three maps were not independently verified.

### Phase 5: one-time public planning research test

The County Connectors research panel now offers **Run One Research Test** on canonical PR #454 preview after the owner resumes the queue. The owner must explicitly confirm the single request. The action is same-origin and owner-only, and reserves one lifetime test slot atomically before dispatch. No retry or reset is available, including after an interrupted request. A completed attempt saves source URL, timestamp, HTTP status, outcome, and bounded extraction in the research key and provides a receipt to NVIDIA Pulse Reactor. Interrupted runs do not emit a completed event. Unattended execution remains disabled.

The reviewed source is the public City of Fort Collins Planning record BDR240012. A single anonymous, bounded GET rejects redirects, access gates, or oversized content and has an eight-second timeout. No external links, documents, or login forms are followed. The extractor keeps only the recognized record reference, title, original parcel, address, and optional decision and date. This is planning evidence for owner review and cannot satisfy a recorded plat or Assessor cross-reference. Glover Estate remains unresolved.

All 118 local workflow tests passed with mocked responses, including owner/origin/preview guards, concurrency, missing/restricted documents, timeout, interruption, and non-publication. The live test was not executed pending explicit owner approval. Wayne records, the 3/3 Larimer GIS trial and production were not written.

### Phase 6: multi-source metadata research and mobile County Connectors

County Connectors now separates GIS verification from parcel history, shows compact coverage and source-progress indicators, and places source references, case evidence and saved events in expandable sections. It retains the original links and review details. The layout has sticky Owner/AI Brain navigation, responsive metric cards, minimum tap target sizing, and reduced-motion handling.

The source catalog describes Assessor, Treasurer, Recorder, Planning and GIS authority, supported records, access restrictions, and budget. The first three adapters can fetch only their fixed public informational page via one anonymous, size- and time-bounded GET, with no redirects, forms, attachments, or document portals. The planning test remains a separate one-time receipt; GIS is catalog-only because Larimer's trial is exhausted. Public page metadata is research context, not a parcel history, recorded plat, or identifier cross-reference. Recorder images still require authorized access.

**Run Next Research Source** requires owner authentication, the canonical preview, same origin, and explicit confirmation for the displayed source and current reservation count. It checks that the original planning attempt completed, retains the existing state, and uses conditional checkpoints and a two-request ceiling per approved source. Unavailable responses back off; any retry requires another confirmation. Stored research reservation, pause/resume, HTTP outcome and evidence receipts feed the Reactor. No scheduling or publication path was added.

Glover Estate remains Unresolved / Owner review. No official source collection was run, no model or paid service used, and no verified relation claimed. The next live action is an owner-confirmed metadata request in preview; recorded plat and Assessor lineage remain separate authorized-access work. Wayne and the Larimer 3/3 GIS trial keys are untouched. All 122 local workflow tests passed.

### Mobile County Connectors runtime repair

The Phase 6 saved-research-evidence loop used `const document=entry.document` and then attempted `document.createElement`. With any saved planning receipt, that name shadowed the browser DOM object and stopped the research panel before its controls rendered. Renamed the evidence variable, handled incomplete legacy metadata/diagnostics and non-JSON fetch failures, moved research controls ahead of collapsed evidence, and hid the completed one-time test button while retaining its status and receipt. No backend or storage paths changed.

A Chromium test with mocked owner responses passed at 320, 375, 390, and 430 CSS pixels. It renders the saved BDR240012 receipt and a legacy metadata record, expands the source, evidence, case, GIS and timeline sections, verifies width and button visibility, tests cancel/confirm and pause/resume, and verifies page initialization makes no POST or external requests. Run from the root with `node kinvest-liens/tests/county-connectors-mobile.cjs` (Playwright and Chromium). No live research or GIS action was performed.

### Phase 7: research receipt audit and parcel document plans

On 2026-11-22, the owner reported 3/3 queued sources finished or budget closed. Netlify request logs showed five successful POST responses from the preview research function between 03:18:44 and 03:49:36 UTC, without action names, upstream response bodies or per-source outcomes. The private research endpoint returned 401. These logs cannot attribute results to Planning, Assessor, Treasurer or Recorder; the Planning success remains owner-reported. The public map feed still showed 13 Wayne polygons at version 13 and zero Larimer corrections.

The owner Research Audit now projects saved reservations, completed receipts, observed upstream HTTP responses, timestamps and remaining slots independently. It shows a saved endpoint when present, distinguishes configured endpoints, deduplicates receipts, and labels planning evidence versus access metadata. Missing or interrupted receipts are not successes. No state migrations or writes were added.

Parcel Document Search lists reviewable plans for the Larimer Assessor parcel and schedule form, the Recorder's Easy Access subdivision/reception index, and Treasurer sale-list cross-reference. The Recorder documents anonymous index-only access; viewing images requires authorized access, with fees possible for unwatermarked copies. The Assessor form does not itself establish parcel lineage, and the Treasurer source does not document an automated identifier API. The planner validates source-specific exact identifiers and candidate provenance and emits stable plan IDs for future deduplication. No automated document lookup, budget allocation, transport, scheduler, or publication route is exposed. A future adapter needs source-specific permission, a separate reservation/checkpoint, and an owner-approved bounded test. First recommended official lookup is the exact Glover Estate plat index search to obtain a reception number and recording date.

All 126 workflow tests passed locally. The mocked Chromium owner flow passed at 320, 375, 390, and 430 CSS pixels, including both new sections, no overflow, and no page-load POSTs. No live source research or GIS requests were sent, no quotas or checkpoints reset, and Glover Estate remains unresolved.

### Phase 9: Glover Estate recording reference

The previously approved Assessor Account CSV GET returned HTTP 200 and 178,429 data rows. The download finished on 2026-11-22 at 04:25:13 UTC, generation 1795252332533535. CSV line 59,825 identified current parcel 9701484001, schedule 1688587, account R1688587, 741 Lindenmeier Rd, Fort Collins, CO 80524, subdivision code 6541001000, tax year 2026, and short legal description “LOT 1, GLOVER ESTATE, FTC (20260006626).” Original parcel 9701400014 and schedule 0155675 were absent from this current snapshot. [Official CSV](https://storage.googleapis.com/lc-public/asr/assessor-public-account.csv) · [Saved retrieval receipt](https://github.com/Skyrease124/vvsodd/pull/454#issuecomment-7074169434)

[Fort Collins BDR240012](https://accela-aca.fcgov.com/CitizenAccess/Cap/CapDetail.aspx?Module=Planning&TabName=Planning&agencyCode=FTCOLLINS&capID1=24CAP&capID2=00000&capID3=00142) identifies the original parcel and the approved minor subdivision. The current Assessor account identifies Lot 1. A recorded plat with parent tract and lot descriptions and an Assessor history or split record explicitly cross-referencing the identifier pairs are still needed to distinguish renumbering, subdivision, a split, or a different legal parcel. The relationship remains Unresolved · Owner review.

The disabled owner document planner shows the CSV-derived number as a candidate. A source-specific validator can record a single exact official index entry with document type and recording date and flags multiple exact rows as conflicting. It leaves succession unresolved. No index transport or receipt write was added. The prepared action, pending separate approval, is one manual Document Search by exact Reception Number 20260006626 at the [Larimer County Recorder index](https://records.larimer.org/landmarkweb). Opening the portal precedes one targeted index submission. It uses zero application research reservations and zero GIS requests. Stop if restricted. Record public index metadata only. [Recorder access rules](https://www.larimer.gov/clerk/recording/easy-access)

128 local workflow tests passed. No additional official source lookup or state write ran.

### Wayne parcel review queue

The existing bounded Detroit GIS worker now saves an exact row identity, reason, verification stage, timestamp, and GIS trace before advancing past a parcel-specific rejection. The guarded publisher reports definitive recheck failures to the worker and excludes unresolved review entries from later publication passes. Network and provider-wide errors retain the cursor and back off; source-wide rate, access, and service errors pause GIS dispatch for 15 minutes. After the cooldown the worker can probe again, subject to the existing quota and owner controls. No new connector, production schedule, or publication authorization was added.

The owner dashboard shows the eligible Detroit verification cohort, scanned processing completion, verified coverage, pending rows, skipped rows and the subset exhausted by parcel-specific failures. Older cursor positions without a saved outcome are counted as scanned with unknown outcomes. The preview owner can retry one exact saved review entry through the same lease, independent polygon checks and shared budget without rewinding the main cursor. The review evidence stays available after retries. Larimer's owner-controlled research and GIS trials use their existing independent checkpoints.

133 offline workflow tests passed, including continuation after missing parcels, independent publication rejection, bounded parcel failures, source backoff, stale owner retry rejection, concurrency and zero further GIS dispatch at quota exhaustion. No live GIS requests, stored state changes, production deployment or scheduling changes were performed.

### Phase 10: isolated queue validation

The five-parcel fixture runs the actual worker, official geometry validator, and guarded publisher against an isolated in-memory store and mocked GIS responses. It rejects a missing ID, multiple IDs, and an open polygon. After a valid parcel is published, an interruption leaves its cursor and publication intact. A freshly loaded worker resumes at the fifth parcel, backs off after a simulated connection reset, publishes on retry, and completes at 100% processed and 40% verified. Existing fixture coverage also exercises concurrent claims, stale retry selection, and the shared quota cutoff. All 134 local workflow tests passed.

The readiness panel explicitly labels processed count, separate from verified count. Chromium at 390 and 1280 CSS pixels passed mocked owner status and parcel retry approval, with no real preview POST. The actual preview public feeds exposed Wayne version 13 with 13 polygons and Larimer version 0 with zero corrections. Owner-only storage requires an authenticated owner session for live inspection. No live GIS or preview fixture writes were made.

### Live Wayne pilot preflight

Run Live Wayne Pilot is a separate owner-confirmed preview action on the existing Wayne worker. It binds approval to the saved cursor and last-start timestamp and shares the CAS worker lease. It requires three available requests in the existing UTC budget and refuses active cooldowns, exhausted holds, pauses, and saved publication recovery. The per-invocation hard ceiling is three upstream requests including fallback and the independent publisher, with every dispatch using the current shared quota. Only the current verified parcel can enter the pilot's guarded publication pass. A partial lookup at the cap retains the cursor for a later separately confirmed run. The dashboard and Reactor use saved pilot results and separate processing completion from verified coverage. No scheduler was changed.

All 139 local workflow tests passed, including cap exhaustion before geometry and before independent publication, concurrent confirmation, stale checkpoint, source cooldown, cutover, shared quota, and approval guards. The preflight used read-only preview endpoints and mocked fixtures. The public Wayne feed showed 13 polygons at version 13. Owner-only status required authentication, so saved cursor, remaining quota, review entries, and recovery state remain unverified. The live pilot was not started.

### Final integration and mobile readiness

The worker now persists recent skip, retry, and publication outcomes alongside each checkpoint, so an interruption after a saved cursor no longer hides those recorded events from the Reactor. The Reactor displays authoritative shared quota and saved processing counts, deduplicates publication receipts, and refreshes the event DOM only when content changes. Thin flowing paths remain visible with fewer animated fibers on phones. The Owner Dashboard shows separate processed and verified percentages, remaining quota, dispatch blockers, saved errors, and the last successful batch. A recheck time is an eligibility hint, never a scheduled run.

MapTiler retains every verified correction from the same county feed used by the public parcel and Workshop maps, including corrections beyond its baseline drawing limit. The existing identity and geometry filters still apply. The local GitHub workflow suite passed all 141 tests. Mocked mobile and desktop owner dashboard and Reactor tests passed without dispatching a POST. Read-only preview checks and mocked work do not establish current owner-only cursor, review, quota, or recovery state.

### Universal county operations

The registry displays Wayne as the existing Detroit worker and Larimer as disabled research. Do not use the universal checkpoint or budget to overwrite either existing pilot. All other source leads start unconfigured. This release adds no execution endpoint or function schedule for the new engine.

- The connector accepts reviewed HTTPS layer or download URLs pinned to an approved origin. ArcGIS FeatureServer and MapServer use layer metadata and bounded exact queries, including ArcGIS GeoServices REST. GeoJSON accepts RFC 7946 polygons. CSV retains textual IDs and supports a configured GeoJSON geometry field. CSV without authoritative polygon data may inform research but cannot pass verification. Download adapters accept bounded CSV/GeoJSON only (8 MiB); other archive formats and larger extracts need a separately tested intake path.
- Review candidate metadata, the official authority and host, exact parcel and situs fields, string ID type, county bounds, spatial reference, geometry format, query/transfer limits, and source terms. Configure a reviewed dataset revision and a per-county request cap. Run offline source-specific responses for missing, duplicate, valid, and incompatible rows. Keep the entry disabled until a separately approved, bounded preview action is wired and tested.
- The dormant research worker reserves requests atomically against a distinct shared 30-request UTC pool and a per-county ceiling. Its CAS county lease and versioned cursor retain review reasons and source backoff. A provider outage pauses that county while the others can proceed within their budgets. Evidence stays outside the existing overlay. Pilot persistence uses bounded batches with checkpointed evidence; validate storage sizing against a real authorized extract before scaling to very large counties.
- A separate dormant publication boundary requires exact owner approval and re-fetches the authoritative geometry under the same budget and a publication lease. Geometry and its receipt commit atomically to the existing county overlay consumed by all three maps. Wayne and Larimer are excluded. Future activation requires trusted server-side configuration, an authenticated dispatch route, and separate owner-approved publication, including a dataset revision/baseline check.
- The owner-only operations view uses read-only county, state, and processing filters. It displays Wayne's existing persisted progress and quota when authenticated, and does not invent progress for unconfigured counties. The Reactor reads actual stored events only.

All 152 workflow tests passed locally. Provider responses and the new publisher's storage were mocked. No live requests or state writes were made.

### Phase 9 Miami-Dade universal pilot

The proposed official Miami-Dade Property Appraiser layer is https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/6. Indexed official metadata lists polygon geometry, a 13-character text FOLIO, TRUE_SITE_ADDR, and a 1,000-record transfer cap. The parent service advertises EPSG:2236 (ArcGIS 102658). The connector requests and requires EPSG:4326 output and accepts only exact 13-digit identifiers, with one known hyphen format retained in saved research and maps. Exact situs corroboration and supported closed geometry are mandatory. County service terms, live reachability, conversion response, and the first exact official match remain unverified. The initial cohort is ten currently unmapped dataset rows with usable situs and unique IDs. The first original folio is 30-3052-075-0060.

The preview-only owner endpoint and controls ship with activation off and no permit. Future activation requires approval of one server-owned UTC permit. Its three slots, atomically counted against the universal shared pool and county limit, are one layer metadata request and one verification query, plus one independent verification query only after separate publication approval. No third request is issued by the research action. Publication has no exposed route in this release. The county pause, resume, and exact review retry controls require owner authentication, matching origin, explicit confirmation, and the enabled permit. The saved checkpoint is tied to the candidate cohort revision. Wayne and Larimer still use their existing separate workers, budgets, and records.

Mock tests completed the ten-row cohort with 7 evidence saves and 3 review skips, including a timeout and resumed checkpoint, and enforced the permit's combined request ceiling and expiration. The map merger now carries official geometry attribution and optional polygon-estimated acreage; original sale and acreage records remain intact. All 155 workflow tests passed, and mobile checks passed at 320, 375, 390, and 430 pixels. No live GIS request, pilot activation, publication, or state reset occurred.

The Workshop picker uses a compact parcel summary below its embedded map for identity, county, available acreage and official geometry attribution. Browser checks passed at 390 and 1280 pixels on all three map surfaces with an intercepted Miami-Dade overlay and mocked MapTiler style. The fixture was never sent to preview storage.

### Miami-Dade live readiness

The official layer directory identifies MDC.PaParcel at MapServer/6, polygon geometry, a 13-character string FOLIO, TRUE_SITE_ADDR string, native EPSG:2236 (ArcGIS alias 102658), Query, and datum transformation support. ArcGIS documents outSR, but no live provider metadata or parcel query was submitted. The Property Appraiser publishes a liability disclaimer and user agreement. Approval of the intended automated access and reuse remains a separate gate.

Check Readiness reads owner-only preview state and sends no provider request. It shows the saved schema timestamp and WGS84 evidence independently and leaves the live control disabled while terms, a fresh owner permit, or request/cursor conditions are unmet. The worker rejects incompatible native metadata, missing/contradictory WGS84 declarations on returned geometry, and coordinates outside the documented county bounds. Missing records may omit CRS metadata and still enter review safely. Real county reservations, schema outcomes, evidence/retry results, and independently committed publication receipts can appear in the Reactor.

156 workflow tests plus the Reactor event regression passed (157 total). Mocked owner checks passed at 320, 375, 390, 430, and 1280 pixels. No provider query or publication occurred. The hard allocation remains one metadata request, one exact lookup for 30-3052-075-0060, and one independently approved publication recheck.

### Broward prepared connector

Broward has a disabled owner operations entry. The reviewed candidate is FloridaGIO's public Florida_Statewide_Cadastral FeatureServer layer 0, attributed to FDOR and county property appraisers. Layer metadata declares polygons, native EPSG:6439 (ArcGIS alias 102967), Query, pagination, a 2,000-record limit, string PARCELNO and PHY_ADDR1, and numeric CO_NO. The server query must bind CO_NO = 16 and an exact twelve-digit string parcel key. It must then check the returned county, parcel string, corroborating situs, explicit EPSG:4326 and actual coordinates. One record's missing or invalid geometry is a saved review skip. A failed source pauses only Broward. Its checkpoint and quota reuse the Universal worker.

BCPA's interactive map documents 12-digit folios. A BCPA-attributed polygon copy is published under a separate ArcGIS account. The county's download page says Property Appraiser parcel data is available for a fee. The FloridaGIO item is public and enabled for Query/Extract, but includes accuracy and survey-use limitations. No explicit authorization for the intended commercial redistribution was verified. Confirm terms and acquire a reviewed Broward parcel-list dataset before any approved pilot. No Broward source parcels are present in the site dataset and there is no first candidate or active permit.

Read-only official metadata was inspected. No Broward parcel lookup or live verification ran. Broward fixture publication used isolated memory and all three map consumers received the same verified fixture. Existing county workers, quotas, scheduling, and production were not modified.

### Palm Beach prepared connector

Palm Beach uses the same disabled Universal pilot machinery and FloridaGIO Cadastral FeatureServer layer 0 as Broward, with its own county scope and checkpoint. FDOR identifies Palm Beach as CO_NO 60. The state layer supplies text PARCELNO, PHY_ADDR1 situs, numeric CO_NO, polygon geometry in EPSG:6439 (ArcGIS alias 102967), Query/Extract, pagination, and a 2,000-record ceiling. The official Palm Beach PAO_PARCELS FeatureServer layer 0 describes county polygons in EPSG:3087 and includes PARID but does not expose a situs address field. The state layer allows both identity and situs checks in one bounded response. The connector retains the original compact or grouped 17-digit PCN, including leading zeros. It separately checks the response county, identifier, street address and explicit WGS84 polygon.

The county's current PricePocketAsset dataset has 840 records, including 817 polygons and 23 point-only records. None qualify under the current no-overwrite policy. The owner dashboard explains the zero eligible count and offers read-only readiness. No real first PCN or permit was assigned. Public Query/Extract and the state portal's no-cost open-data access are documented, alongside accuracy, confidentiality, and survey-use limitations. Commercial redistribution and the precise live response contract still need confirmation before activation.

Palm Beach fixtures verified ID/situs/county/CRS checks, Skip & Continue, preserved review state through provider cooldown and quota exhaustion, and geometry parity across the three existing map consumers. No provider parcel query, activation, publication, quota reset, or production write occurred. Santa Rosa is the recommended next candidate because the current dataset already contains numerous unmapped rows with situs addresses; its source mapping and terms still need independent review.

### Santa Rosa prepared connector

Santa Rosa uses the official FloridaGIO cadastral FeatureServer layer 0 with FDOR county number CO_NO 67. The checked schema and access limitations match the other FloridaGIO connectors. A bounded exact query accepts the compact or documented grouped surface parcel ID without removing leading zeros, requires the county response and situs address to corroborate identity, and rejects duplicate results. The SRCPA mineral search documents the trailing M suffix; such identifiers are excluded from the surface polygon workflow.

The current dataset has 1,729 unmapped rows, and all 1,729 have Unknown situs. Of those, 1,727 have the M suffix. The earlier handoff's address screening treated placeholders as present. The county has zero eligible pilot records, so the registry remains disabled with no selected parcel or permit. Before activation, source a county-approved surface parcel with a usable situs address and confirm programmatic reuse terms. No provider parcel query or state write ran.

### Florida 67-county directory

Validated all 67 names and independent Census/FDOR identifiers against the Census and Florida source snapshots. Corrected all 67 county FIPS and Full_FIPS values, added explicit GEOID, and preserved the uploaded file and per-field audit. Two read-only service schemas were verified and recorded. County-level parcel validation remains unverified. County Operations exposes the directory, evidence and blockers to owners. Existing FloridaGIO pilot definitions now take their common source and county discriminator from the audited registry. No runner, public map feed, authorization or scheduler was activated.

Current offline screening found one county with eligible candidates (Miami-Dade's ten-row cohort), 52 blocked by missing dataset or zero candidates, and 14 existing datasets still unverified. Santa Rosa remains blocked. Its official ParcelsOpenData layer is a possible supplemental source, but the publisher has not established whether its address fields are situs addresses or cleared the intended reuse. The 1,729 unmapped rows retain Unknown situs and the mineral-rights records remain separate. See tools/florida-gis/README.md for provenance and regeneration.

## Unified Florida Land Discovery

The owner preview includes a county-specific offline import and review section. Source schema and matching
reuse the Florida registry, the existing pilot identifier formats, and the shared polygon validator.
Import and review use a separate `brain-florida-land-v1-<GEOID>` checkpoint with compare-and-swap writes.
The route can store private evidence and approve its exact revision for review. It has no provider,
scheduler, budget mutation, or publication path. Existing map and research-release endpoints are unchanged.

See [the offline operator guide](tools/florida-land/README.md) for source documentation, commands, review
criteria, and supported formats.
