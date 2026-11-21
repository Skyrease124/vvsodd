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
