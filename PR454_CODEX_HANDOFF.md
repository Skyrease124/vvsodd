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
