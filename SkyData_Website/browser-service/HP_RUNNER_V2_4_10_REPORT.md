# HP runner 2.4.10: more REA time for website investigations

Base: runner 2.4.9 and the published website (selected-model navigation). **Not deployed. Linux Docker tested; Windows HP verification pending.** Website code is unchanged except the runner download link.

## What the HP showed (runner 2.4.9, https://cinejoy.pk/, engine REA)
- `Website investigation: timeout · REA analysis did not finish within the 180-second REA limit on this HP.`
- The browser part and selected-model navigation completed. REA, running inside its fixed 150 s internal limit, did not finish.

## Diagnosis (measured, real REA container, Linux Docker)
- **Most of REA's time on a slow CPU is fixed start-up, not input size.** At 0.12 CPU, the same run took 105 s for 70 KB, 105 s for 117 KB, 106 s for 187 KB and 109 s for 303 KB (version check ~22 s plus ~83 s analysis start-up). So smaller inputs or two REA parts do not help; two parts doubled the time (220 s vs 115 s) and were not shipped.
- **The adapter's own limits are fixed** in the REA image: 150 s overall and 30 s for `rea --version`. At 0.06 to 0.09 CPU the version check alone took more than 30 s, giving `REA status incompatible`.
- The website gives an HP job 10 minutes from claim. After the local `yes` and up to 3 minutes of browsing, there is room for more REA time.

## Repair
- `rea/adapter.mjs` (**REA image changes; run `Prepare_REA.cmd`**):
  - A request may carry `deadlineMs`, clamped to 60–330 s. Requests without one, which means every ZIP REA job, keep 150 s.
  - Requests with their own limit allow `rea --version` 90 s; others keep 30 s.
- `rea/Dockerfile`: new label `org.skydata.rea.request-deadline="1"`. The REA version and adapter version are unchanged, so the website's capability checks are unchanged.
- `rea-job.mjs`: reports the label, and forwards `deadlineMs` only when the runner sets one.
- `browser-job.mjs`:
  - With the labelled image, website-investigation REA gets the time left in the job window, minus a 60 s margin for cleanup and the result. That is at most 330 s inside the container plus 20 s for the runner.
  - With an older image it keeps 180 s, and the timeout message says to run `Prepare_REA.cmd`.
  - REA is not started with less than 80 s left.
- **Not changed:**
  - REA isolation: no network, read-only, no capabilities, user 1000, 64 tasks, 1 CPU, noexec tmpfs, `--pull never`; 1 GB for website investigations, 768 MB for ZIP REA.
  - The 384 KB input cap, the browser image, the proxy and the website.

## Verification
| Check | Kind | Result |
|---|---|---|
| `test-hp-browser-rea`: old image keeps 180 s with hint; labelled image 350/330 s; limits fitted to the job window; no REA under 80 s; adapter clamping; `deadlineMs` sent only when set | **mocked** | PASS |
| `test-rea-real` (ZIP REA through Worker + real Docker + real REA, new image) | **real Docker** | PASS |
| `node runner.mjs rea-selftest` (what Prepare_REA runs), new image | **real Docker** | PASS |
| REA image built from `rea/Dockerfile` (npm ci with lockfile integrity) | **real Docker build** | PASS, label present |
| Live job (real Chrome, proxy, REA), REA at 0.06 / 0.09 CPU, 2 scripts / 303 KB | **real Linux Docker** | 2.4.10 + new image: complete (207 s / 156 s). 2.4.9 + old image at 0.09 CPU: failed (`REA status incompatible`, version check over 30 s) |
| Other runner and website suites, `tsc`, build, ESLint (0 errors) | mocked / Miniflare / local | PASS |
| ZIP integrity | local | 39 files identical to `runner-package/`; browser image inputs identical to 2.4.9 |
| Windows HP | real Windows HP | **NOT RUN, pending** |

## Install on the HP (pairing is kept)
1. Ctrl+C the runner window.
2. Extract `SkyData_HP_Runner_v2_4_10.zip` into a **new** folder.
3. Run `Prepare_REA.cmd` (needs internet once; rebuilds the REA image and runs its self-test). `Prepare_Browser.cmd` is not needed if 2.4.9's passed.
4. Run `Start_Runner.cmd`. The REA line should end with "extended time limit for website investigations".
5. Close other heavy programs (e.g. video playback), retry, and type `yes`.
