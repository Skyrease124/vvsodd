# HP runner 2.4.4: slow viewport changes during evidence collection

Base: runner 2.4.3 (branch `claude/browser-pids-fix`, on top of website v116). **Not deployed. Linux Docker tested; Windows HP verification of 2.4.4 is pending.**

## What the HP showed (runner 2.4.3, live investigation of https://cinejoy.pk/, engine REA)
- The owner typed `yes`. The run passed launch, the origin guard, the first navigation and "Inspecting interface".
- It then failed with `RPC response timed out after 10000ms: page.set_viewport_size`.
- Runner window: `Stopped at: Collecting evidence · browser tasks 129/512 · task limit hits 0`. The 2.4.3 task-limit fix held; this is a different failure.

## Diagnosis

### Confirmed from the source
1. In "Collecting evidence" the worker calls Stagehand `page.setViewportSize(width,900)` for 1440 and 390, then resets to 1440. Any error there failed the whole investigation.
2. In Stagehand 4.2.1, `page.set_viewport_size` is not in the list of operations that get a longer default timeout, and its options accept only `deviceScaleFactor`. So its RPC reply limit is a fixed 10 s (`RPC_RESPONSE_GRACE_MS`) that callers cannot change.
3. The extension implements it as CDP `Emulation.setDeviceMetricsOverride` followed by `Emulation.setVisibleSize`. Chrome answers only after the page's renderer has applied the new size. When the RPC times out, Stagehand stops waiting, but Chrome keeps applying the change.

### Reproduced on real Linux Docker (Chrome for Testing 155, your unchanged worker, proxy and Docker flags)
Test-only fixture pages stood in for a heavy site:
- **"busy":** the main thread is blocked for 15 or 45 s right after the page is inspected.
- **"layout":** 30,000, 40,000 or 60,000 flex items.

| Fixture | 2.4.3 worker | 2.4.4 worker |
|---|---|---|
| plain page | pass | pass ×2 (each resize 10–25 ms) |
| busy 15 s | **fail ×2: `RPC response timed out after 10000ms: page.set_viewport_size`, Collecting evidence** | **pass ×3**: the 1440 resize applied after ~15.5 s; both screenshots |
| busy 45 s | (not run) | **pass**: 1440 not applied within 32 s, so that screenshot was skipped; 390 applied 13 s later and was captured |
| layout 30,000 | pass | pass (resizes 0.4–1.9 s) |
| layout 40,000 | **fail: same 10 s error** | fail: 390 never applied within 30 s, then Chrome crashed (`SEGV` / `CDP connection closed`) |
| layout 60,000 | **fail ×2: same 10 s error** | fail ×2: same crash after the bounded wait |

- Task use at failure was 138–144 of 512 with 0 task-limit hits, close to the HP's 129. Memory `failcnt` was 0.
- A control run without the new polling crashed the same way ("Target crashed"), so the crash comes from the page, not from the fix.

### Hypotheses (not proven for cinejoy.pk)
- **Likely:** cinejoy.pk kept the HP renderer busy for more than 10 s after the width change on a 1-CPU container. The pattern matches: it failed at the first evidence step, after reading the page succeeded.
- **Unknown:** whether that page recovers (now handled) or hangs the renderer for good (still a failure, now reported with viewport outcomes). 2.4.4 prints each viewport's outcome on failure, which will show which case it is.

## Repair (focused)
- `browser-service/worker.mjs` (mirrored in `runner-package/browser-service/`):
  - When the viewport change hits Stagehand's 10 s RPC timeout (`RPCResponseTimeoutError` only), the worker polls the page's width through the existing Playwright connection. It waits up to 20 s more per change and at most 60 s per job; once the budget is spent, later viewport changes are skipped.
  - A viewport that never applies, or a screenshot that times out, skips only that screenshot. The report lists it as a limitation.
  - Any other error still stops the investigation, as before.
  - The result and failure details include a small `viewports` list (width, applied, ms; at most 9 entries).
- `runner-package/browser-job.mjs`: the self-test report includes `viewports`. The self-test still requires the 390 px screenshot to pass.
- `runner-package/runner.mjs`: version 2.4.4. A failed live job also prints `Viewports: 1440px ok (0 s), 390px not applied (30 s), …`.
- Docs (`README.txt`, `BROWSER_SETUP_WINDOWS.txt`) and the runner page link updated to 2.4.4.
- **Not changed:**
  - Container limits (512/64 tasks, 1 GB, 1 CPU), read-only root, `--cap-drop ALL`, no-new-privileges, user 1000, noexec tmpfs, internal network, `--pull never`, no host mounts or host networking.
  - The proxy, URL policy, exact extension origin and origin-guard checks; the 180 s job deadline; the three model calls; and Stagehand and adapter versions (so the website capability checks are unaffected).
  - Website APIs, ZIP investigations, REA, Superpowers, chat, models, voice, Polly, Chill Mode, authentication, ownership and hosting.

## Verification
| Check | Kind | Result |
|---|---|---|
| `browser-service/test/viewport-timeout.test.mjs` (new): real `worker.mjs` with stub Stagehand/Playwright | **mocked** | PASS 3/3. A late viewport is captured (~1.5 s); one that never applies is skipped within the 20 s bound with a limitation; other errors still fail |
| `browser-service` unit tests | local | 13/13 PASS |
| `test-hp-browser-diagnostics` (adds viewport-line check), `test-hp-browser`, `test-hp-runner` | Docker CLI **mocked** | PASS |
| `test-hp-browser-worker`, `test-website-investigation`, `test-website-unavailable` | built Worker + Miniflare, browser/Gemini **mocked** | PASS |
| `tsc --noEmit`, `npm run build` | local | PASS |
| ESLint, changed files | local | 0 errors in changed JS; `page.tsx` has the same 3 earlier errors on lines I didn't change |
| Runner code from the **extracted 2.4.4 ZIP** | **real Linux Docker + real Chromium 155** | plain ×2, busy 15 s, busy 45 s: PASS (guard true, 5 probes blocked, cleanup confirmed, ~200 tasks, 0 limit hits). layout 40k: fails honestly after the bounded wait (Chrome crash). No containers or networks left |
| ZIP integrity | local | 39 packaged files identical to `runner-package/`; 11 mirrored browser-service files identical to `browser-service/` |
| Windows HP self-test and live investigation with 2.4.4 | real Windows HP | **NOT RUN, pending** |

Limits of this verification:
- This sandbox cannot reach the public internet from containers, so cinejoy.pk itself was not loaded here; the fixtures only approximate a heavy page.
- The Chromium was Chrome for Testing 155 in a test-only image built from host libraries, not Debian's `chromium`.
- The fixture files are not shipped.

## Install on the HP (pairing is kept)
1. Stop the old runner window (Ctrl+C).
2. Extract `SkyData_HP_Runner_v2_4_4.zip` into a **new** folder.
3. Keep Docker Desktop running, then double-click `Prepare_Browser.cmd`. It rebuilds the browser image with the new worker and runs the self-test. This step is required: the old image still contains the old worker.
4. When it passes, double-click `Start_Runner.cmd`. Do not pair again.
5. Run the investigation from the website again and type `yes`. If it fails, send a photo of the runner window: it now shows the `Viewports:` line.
