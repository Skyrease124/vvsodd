# HP runner 2.4.9: AI navigation relay failure no longer discards the investigation

Base: runner 2.4.8. **Not deployed. Linux Docker tested; Windows HP verification of 2.4.9 is pending.** The website part (relay status) is in the source ZIP and needs publishing through ChatGPT Sites.

## What the HP showed (runner 2.4.8, https://cinejoy.pk/, engine REA, two runs)
- Both runs: `Website investigation: failed · Browser reasoning relay failed: 502`, then `Stopped at: Examining functionality`.
- Task use was 130/512 and 136/512, with 0 limit hits.
- `Viewports: 1440px ok, 390px ok, 1440px ok`: capture and screenshots had finished.
- **Not memory:** REA never started.

## Diagnosis
- **Confirmed (source):**
  - In "Examining functionality", Stagehand `observe` calls the worker's model callback, which goes through the egress proxy to `/api/engineering-runner/browser-model` on the website, and from there to Gemini.
  - The website handler returns `502 Browser navigation model failed` for **any** exception: a Gemini error such as a 429 quota, the 40 s timeout, a schema or JSON error, and so on. The real reason is discarded.
  - The worker treated that as fatal, so the evidence already collected was thrown away.
- **Reproduced, real Linux Docker:** a live job (Chrome, proxy and REA all real), where the sandbox relay cannot reach the website.
  - 2.4.8 worker: 2/2 `failed · Browser reasoning relay failed: 403`. Here the status is the sandbox proxy's; the failure class matches the HP.
  - 2.4.9 worker: 2/2 complete, with REA findings and the stated limitation.
- **Likely, not proven:** the HP's 502 is a Gemini free-tier quota or rate limit after many runs today. The relay passed this step in the earlier successful run. The website fix below will show Gemini's real status.

## Repair
- `browser-service/worker.mjs` (mirrored; **browser image changes, run `Prepare_Browser.cmd`**):
  - The model callback records a relay failure, whether a non-OK status or no answer.
  - If `observe` then fails, navigation stops with the limitation "AI-guided navigation stopped: …. No retry was made; the report uses the pages collected before that."
  - The job then continues to technology analysis and REA. Any other `observe` error still fails the job.
- `lib/hp-browser.ts` (website, **needs publishing**): the relay error includes Gemini's HTTP status (e.g. `Browser navigation model failed (Gemini HTTP 429). No paid fallback.`), and a 429 is passed on as 429. No provider text or key material is forwarded. The egress proxy already passes the status to the worker.
- Not changed: the three-call budget, no retries, isolation, limits, proxy, REA settings and website validation.

## Verification
| Check | Kind | Result |
|---|---|---|
| `browser-service` tests (adds: unreachable relay keeps evidence and completes; non-relay `observe` error still fails) | **mocked** Stagehand/Playwright, real worker | 16/16 PASS |
| `test-hp-browser-worker` (adds: Gemini 429 → relay 429 with status, no key in body) | built Worker + Miniflare, Gemini **mocked** | PASS |
| `test-hp-browser-rea`, `test-hp-browser`, `-diagnostics`, `-runner`, `test-rea-job`, `test-rea-result`, `test-website-investigation`, `-unavailable` | mocked / Miniflare | PASS |
| Live job with a failing relay, as above | **real Linux Docker + Chromium 155 + real REA** | 2.4.8: 2/2 fail; 2.4.9: 2/2 complete; no containers left |
| Browser self-test from the extracted 2.4.9 ZIP | real Linux Docker | PASS (guard, 5 probes blocked, cleanup) |
| `tsc`, build, ESLint (0 errors) | local | PASS |
| ZIP integrity | local | 39 files identical to `runner-package/`; 11 mirrored files identical |
| Windows HP | real Windows HP | **NOT RUN, pending** |

## Install on the HP (pairing is kept)
1. Ctrl+C the runner window.
2. Extract `SkyData_HP_Runner_v2_4_9.zip` into a **new** folder.
3. Run `Prepare_Browser.cmd` (required: the browser worker changed) and wait for the self-test to pass.
4. Run `Start_Runner.cmd`. Do not pair again.
5. Retry and type `yes`.
