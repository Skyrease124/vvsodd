# HP runner 2.4.6: REA step timeout in website investigations

Base: runner 2.4.5. **Not deployed. Linux Docker tested; Windows HP verification of 2.4.6 is pending.**

## What the HP showed (runner 2.4.5, https://cinejoy.pk/, engine REA)
- Runner window: `Website investigation: timeout · REA capture analysis did not pass integrity checks`.
- There was no `Stopped at` line. **The browser capture finished** (the 2.4.4/2.4.5 fixes held); the failure came after it, in the REA analysis of the captured JavaScript.

## Diagnosis
- **Confirmed (source):** the REA step of a website investigation gave the REA container only **90 s** (`deadlineMs:90000`). ZIP REA jobs use `REA_LIMITS` (180 s), and the REA adapter inside the image is built around a 150 s internal limit. So the runner always killed REA first, and the timeout was reported with the generic "integrity checks" message. This was my mistake in the earlier REA integration.
- **Confirmed (REA 6.4.0 source):** `--analysis-timeout-ms` (60 s in the adapter) applies **per JavaScript file**, so with up to 20 captured files REA cannot keep a whole run inside a fixed limit on its own.
- **Measured (real REA container, real minified JS libraries, Linux Docker, same 768 MB / user 1000 / no network flags):**

| Input | CPU | Time | Result |
|---|---|---|---|
| 187 KB (2 files) | 1 | 21 s | partial findings |
| 430 KB (5 files) | 1 | 43 s | partial findings |
| 965 KB (11 files; about what a browser capture can hold) | 1 | **91 s** | partial findings, just past the old 90 s limit |
| 965 KB | 0.4 (models a slower HP) | 150 s | **timeout** (adapter's 150 s limit) |
| 500 KB | 0.4 | 148 s | partial findings, 2 s from the limit |
| 348 KB | 0.4 | 97 s | partial findings, ~50 s headroom |

- **Likely, not proven:** cinejoy.pk's captured scripts were large enough that REA could not finish within 90 s on the HP. The HP's actual REA speed has not been measured.

## Repair (`runner-package/browser-job.mjs` only)
- The website-investigation REA step uses the same `REA_LIMITS` as ZIP REA (180 s, unchanged memory and isolation).
- At most **384 KB** of captured JavaScript is sent to REA, in capture order; scripts that don't fit are skipped.
  - Skipped scripts are also removed from `evidence.scripts`, so the website's existing check (REA's staged files must equal the evidence scripts) still compares exactly what REA analysed.
  - The report gets a limitation such as "REA analysed 4 of 9 captured scripts (348 KB)…".
- A REA timeout now says `REA analysis did not finish within the 180-second REA limit on this HP.` instead of the integrity message.
- The browser worker and both images are unchanged from 2.4.5. Website, ZIP REA and the REA adapter are also unchanged.
- **Worst case per investigation:** about 2 min waiting for the local `yes`, plus 3 min of browsing, plus 3 min of REA, plus cleanup. That is inside the website's existing 10-minute window for a running HP job.

## Verification
| Check | Kind | Result |
|---|---|---|
| `scripts/test-hp-browser-rea.mjs` (new): 180 s limits used, 384 KB cap, evidence scripts = staged files, limitation text, no cap note when under the cap, timeout message | Docker CLI, worker and REA **mocked** | PASS |
| `test-hp-browser`, `test-hp-browser-diagnostics`, `test-hp-runner` | Docker CLI **mocked** | PASS |
| `test-hp-browser-worker`, `test-website-investigation`, `test-website-unavailable` | built Worker + Miniflare, browser/Gemini **mocked** | PASS |
| `browser-service` unit tests | local | 14/14 PASS |
| `tsc --noEmit`, `npm run build`; ESLint on changed JS | local | PASS; 0 errors |
| REA timing table above | **real REA container, real Linux Docker** | as listed; cleanup confirmed in every run |
| Browser capture followed by REA in one live job | real | **not run here**: a live job needs the website's model relay. The browser part is covered by the 2.4.5 real-Docker runs, the REA part by the runs above, and the wiring between them by the mocked test |
| ZIP integrity | local | 39 packaged files identical to `runner-package/`; 11 mirrored browser-service files identical; worker, Dockerfiles and REA adapter identical to 2.4.5 |
| Windows HP | real Windows HP | **NOT RUN, pending** |

## Install on the HP (pairing is kept)
1. Ctrl+C the old runner window.
2. Extract `SkyData_HP_Runner_v2_4_6.zip` into a **new** folder.
3. If 2.4.5's `Prepare_Browser.cmd` already passed on this HP, the images are current; otherwise run `Prepare_Browser.cmd` first.
4. Double-click `Start_Runner.cmd`. Do not pair again.
5. Retry cinejoy.pk and type `yes`. If it fails, send a photo of the runner window.
