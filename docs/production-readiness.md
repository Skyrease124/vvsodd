# Production readiness: Rochester parcel positions and this round's changes

**Status: not ready to merge or deploy.** This branch runs on Netlify Preview 454 only. Nothing has been merged or deployed
to production, and the public address corrections have not been applied. Each item below is marked done, open, or not
performed.

## 1. Scope

- Branch: `integration/brain-map-452-453-preserve` (PR #454). Preview: https://deploy-preview-454--pricepocketasset.netlify.app
- Production target: the default branch of `skyrease124/vvsodd`. This clone does not set `origin/HEAD`, so confirm the
  merge target before any merge.
- This round is one commit on top of `ee306d8`. It changes the Rochester builder, the matcher, the coverage report, the
  publish boundary and the tests. It does not change Stripe, support pages, API keys, or the AI code (checked by path).

## 2. The seven requests

| # | Request | Result | Status |
|---|---|---|---|
| 1 | Fix the Rochester list builder's spelling | Builder fixed (`tools/rochester-ny/build.py`). 11 verified corrections in `address-corrections.json`, each checked against the matches audit. The public list and map data still show the old spelling. | Builder done. Public correction **gated** until the Pro window ends. |
| 2 | Preserve records, positions, polygons, sources and approval history | The apply step changes only the 11 address fields. A test on a copy checks every record, identity, position and boundary, and confirms the matches audit is byte-identical. An offline rerun of the matcher reproduces the committed audit exactly, except `generatedAt`. The release index and approvals are not touched. | Done (tested on copies). |
| 3 | Make the matcher reusable | Identifier normalizers (`ny-sbl`, `alphanumeric`, `exact`), declarative field mapping for new layers, `run.mjs --all` and `--report`. The Rochester audit is unchanged. A fictional county is matched from configuration alone. | Done. |
| 4 | Report location coverage by state and county | `docs/location-coverage.md` and `.csv`, generated from the published files. 182 datasets, 54,560 records: 36,496 located, 18,064 unlocated. | Done. |
| 5 | Production readiness checklist | This document. | Done. Not a sign-off. |
| 6 | Keep restricted parcel data off public static files before the window ends | Audit found exposures on the committed tree (section 6). They are removed here. A publish-boundary test and a dedicated workflow now guard the published tree and the store readers. | Done in the tree. Production history not checked (section 6). |
| 7 | Preserve Stripe, support pages, API credentials and AI systems | Checked by path: no changed file is in those areas, and no tracked file in them has a diff. | Done. |

## 3. Tests (this round)

- **Offline pipeline and static tests**: 57 commands, 0 failures, 11 seconds. These are the `offline-pipeline` job of
  `validate-brain-map.yml` (including the new Rochester, matcher, coverage and publish suites), plus the static tests of
  `validate-map-polish.yml`.
- **Browser suites**: 6 of 6 pass against the static server on 127.0.0.1:8765: `map_polish`, `map_behavior`,
  `brain-activity-page`, `brain-intake-page`, `map_approved_records`, `brain-reactor-mobile`.
- **Matcher reproduction**: an offline rerun of the Rochester audit equals the committed audit, except `generatedAt`.
- **Negative checks**: the publish-boundary test fails on the tree as it was before this round (section 6), and it catches
  a planted matched position and a planted ungated store reader.
- **Not run**: no live GIS query, no NVIDIA or other paid API request. `ci-local.py` is not in this repository, so the
  workflow's job commands were run instead.

## 4. Owner test evidence

- `docs/owner-brain-manual-tests.md`, Test 13 (Rochester import, batch approval, map check). Before this round the owner
  confirmed batch approval and the map markers on Preview 454.
- This round changed the matcher, the tests and the Rochester tools. It did not change the owner pages' behaviour; the
  intake browser suite passes.
- Open: repeat Test 13 on the Preview 454 build from this commit.

## 5. Data

- **Published files**: unchanged in this round. The apply step has not been run.
- **Pending public correction**: 11 addresses in `kinvest-liens/liens/states/liens-rochester.js` and
  `kinvest-liens/map/data/NY-city-of-rochester.json`, listed in `tools/rochester-ny/address-corrections.json`.
- **Server-side**: 191 approved records in `netlify/lib/data/parcel-matches/NY-city-of-rochester.json`. Unchanged.
  Approvals and the release index are not touched.
- **Coverage**: `docs/location-coverage.md`. Rochester has 191 records, 0 located in the published file, and 191 matched on
  the server.

## 6. Restricted information and the Pro window

- **Window**: each approved release is visible to Pro members first. Free visitors see it 48 hours after the Pro release
  (`PRO_EARLY_ACCESS_MS`; `freeReleaseAt` = `proReleaseAt` + 48 hours).
- **Found on the committed tree before this round**, in the published tree (`kinvest-liens`):
  - one official parcel ID of an approved record (120.74-2-13, 81 Aberdeen St) in a test fixture;
  - three corrected official addresses (363 Avenue A, 653 Averill Ave, 139 Avis St) in published test files;
  - the official evidence link for 106.22-4-23 in a browser test fixture.
  - No matched position or boundary point was in the published tree.
- **Fixed here**: the two Rochester tests that held those values moved to `tests/` (not published). Two test files now read
  the expected values from the corrections manifest at run time. The browser fixture uses fictional values.
- **Caveat**: this repository does not show whether production has ever served those test files. Check the production
  deployment history and its file list before merging.
- **Store readers**: five server functions read the restricted release or intake stores: `brain-map-records`,
  `certificate-review`, `export`, `owner-property-intake`, `research-updates`. Each is owner-gated or visibility-filtered.
  `tests/publish_boundary.test.mjs` fails if a new reader is neither.

## 7. Not performed (each needs an owner decision)

- Merge PR #454 into the production branch: **not performed**. Needs explicit approval.
- Production deployment: **not performed**.
- Apply the 11 public address corrections: **not performed**. Needs the end-of-window time, which is the latest
  `freeReleaseAt` among the Rochester releases. The script refuses any earlier time.
- New property data or owner approvals: none in this round.
- Scheduled tasks: none added or activated. The new workflow, `validate-publish-boundary.yml`, runs on push and pull
  request only.
- Paid or live API calls: none.

## 8. Risks and open items

1. **Early apply.** Applying the corrections before the latest `freeReleaseAt` shows official addresses to free visitors
   before they may see the approved records. Apply only after that time.
2. **Rebuilding the list.** Running `build.py` rewrites `liens-rochester.js` with the corrected spelling. Do not commit a
   rebuilt file before the apply.
3. **Map data drift (existing, not caused here).** Running `tools/map/build.mjs` on the committed tree changes
   `AL-02.json`, `AZ-cochise.json` and `map/index.json`, and adds `AL-mobile-county.json`. So the committed map data is not
   exactly what its builder produces. Do not run the full builder for this change; reconcile it separately.
4. **Monroe County layer.** It found 0 of 190 parcel numbers. Only the City layer matched.
5. **Florida registry.** 67 counties, all `unverified`, none with live execution enabled.
6. **Data freshness.** The matching used the cached City layer response from earlier. No live query was made in this round.
7. **Browser suites.** They need Chromium and Playwright, which CI provides in the Playwright container.

## 9. Rollback

- **Before a merge**: revert this branch's commit. Nothing is deployed.
- **After a merge**: revert the merge commit. If the corrections were applied, also revert the apply commit (the manifest's
  `appliedAt` is part of it), then re-run `tools/map/static-baseline.mjs` so the baseline matches the reverted files.
- **Visibility**: withdraw a release from the owner Research updates page to hide it from every viewer, Pro included.

## 10. Sign-off checklist

- [ ] Owner confirms the merge target and approves merging PR #454.
- [ ] CI is green on the head commit (`validate-brain-map`, `validate-map-polish`, `validate-publish-boundary`).
- [ ] Preview 454 re-checked: Test 13, the intake and map pages, and Pro and free visibility.
- [ ] Production deployment history and file list checked for the old test files.
- [ ] End-of-window time agreed. The apply is run after it, and the publish-boundary test is green afterwards.
- [ ] `docs/location-coverage.md` regenerated after any data change.
