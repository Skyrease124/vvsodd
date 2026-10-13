# HP runner 2.4.5: screenshot timeouts on busy pages

Base: runner 2.4.4 (see `HP_RUNNER_V2_4_4_REPORT.md`). **Not deployed. Linux Docker tested; Windows HP verification of 2.4.5 is pending.**

## What the HP showed (runner 2.4.4, https://cinejoy.pk/, engine REA)
- The investigation failed with `screenshot timed out after 20000ms`.
- Runner window: `Stopped at: Collecting evidence · browser tasks 128/512 · task limit hits 0`, then `Viewports: 1440px ok (1 s)`.
- So the 2.4.4 viewport fix worked: the width changed in 1 s. The **screenshot** that follows then took more than its 20 s limit.

## Diagnosis
- **Confirmed (source):** the timeout comes from the Stagehand extension, whose error is named `TimeoutError`. 2.4.4 handled only the client-side `RPCResponseTimeoutError`, so this error still ended the whole investigation. That was an omission in 2.4.4.
- **Reproduced (real Linux Docker, Chrome 155):** a test page that blocks its main thread for 30 s just before the screenshot makes 2.4.4 fail with exactly `screenshot timed out after 20000ms` in Collecting evidence.
- **Likely, not proven:** cinejoy.pk keeps the HP's renderer too busy to produce a frame within 20 s.

## Repair
- `browser-service/worker.mjs` (mirrored):
  - Both timeout errors are handled. A screenshot that times out is skipped and listed as a limitation.
  - Slow screenshots draw on the same 60 s per-job budget as slow viewport changes.
  - When any capture timed out, the page is marked busy. It is not navigated further (no more model calls on it), and the report uses the pages collected so far.
  - Other errors still stop the investigation.
- `runner.mjs`: version 2.4.5. The `Viewports:` line also shows `screenshot timed out`.
- The self-test is unchanged and still requires the 390 px screenshot. Isolation, limits, proxy, origin checks, website code paths and Stagehand/adapter versions are unchanged.

## Verification
| Check | Kind | Result |
|---|---|---|
| `viewport-timeout.test.mjs` (adds the `TimeoutError` screenshot case: skipped, busy page not navigated, observe not called) | **mocked** | PASS 4/4 |
| `browser-service` unit tests | local | 14/14 PASS |
| `test-hp-browser-diagnostics`, `test-hp-browser`, `test-hp-runner` | Docker CLI **mocked** | PASS |
| `test-hp-browser-worker`, `test-website-investigation`, `test-website-unavailable` | built Worker + Miniflare, browser/Gemini **mocked** | PASS |
| `tsc --noEmit`, `npm run build`; ESLint on changed JS | local | PASS; 0 errors |
| Screenshot-blocking page | **real Linux Docker + Chromium 155** | 2.4.4: FAIL, `screenshot timed out after 20000ms` (as on the HP). 2.4.5: PASS, 1440 screenshot skipped, 390 captured, 5 probes blocked, cleanup confirmed |
| Plain page; 15 s busy page | real Linux Docker | 2.4.5: PASS both |
| Self-test from the extracted 2.4.5 ZIP | real Linux Docker | plain page PASS; screenshot-blocking page PASS (1440 skipped, 390 captured); no containers left |
| ZIP integrity | local | 39 packaged files identical to `runner-package/`; 11 mirrored browser-service files identical |
| Windows HP self-test and live cinejoy.pk investigation | real Windows HP | **NOT RUN, pending** |

The busy-page "stop navigating" branch only applies to live jobs, and only the mocked test exercises it: the self-test never navigates further. Cinejoy.pk itself cannot be loaded from this sandbox.

## Install on the HP (pairing is kept)
1. Ctrl+C the old runner window.
2. Extract `SkyData_HP_Runner_v2_4_5.zip` into a **new** folder.
3. Run `Prepare_Browser.cmd` (required: it rebuilds the image with the new worker).
4. When the self-test passes, run `Start_Runner.cmd`. Do not pair again.
5. Retry the investigation and type `yes`. If it fails, send a photo of the runner window.
