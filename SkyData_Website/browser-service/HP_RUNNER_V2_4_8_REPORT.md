# HP runner 2.4.8: REA infrastructure_error in website investigations

Base: runner 2.4.7. **Not deployed. Linux Docker tested; Windows HP verification of 2.4.8 is pending.**

## What the HP showed (runner 2.4.7, https://cinejoy.pk/, engine REA)
- First investigation (`16d78925…`): **complete**. That was the first fully successful live run: real Chrome on the HP, the local `yes`, the captured scripts and real REA. Its report then failed on the website side ("Report model failed"; the fix for that message is in the website source and is not deployed).
- Second investigation (`aaa6f53d…`): `failed · REA capture analysis did not pass integrity checks (REA status infrastructure_error).`

## Diagnosis
- **Confirmed (source):** with cleanup confirmed, `infrastructure_error` from the REA step means one of the following, and 2.4.7 did not record which:
  1. `docker create` failed;
  2. the docker CLI process died;
  3. the container ended without readable adapter output.
- **Measured (real REA container, real minified JS, Linux Docker, 1 CPU):**

| Input | Memory limit | Peak RSS | tmpfs (same limit) | Result |
|---|---|---|---|---|
| 187 KB | 768 MB | 495 MB | 33 MB | partial findings |
| 348 KB (2.4.6 cap) | 768 MB | 708–710 MB | 33 MB | partial findings, **~97% of the limit** |
| 430 KB | 768 MB | 722 MB | 33 MB | partial findings |
| 965 KB | 2 GB (test only) | 771 MB | 47 MB | needs more than 768 MB |
| 348 KB | 400 MB (test only) | — | — | REA's analyzer subprocess was killed and REA still returned partial findings |

- **Hypothesis (likely, not proven):** a heavier set of cinejoy.pk scripts pushed the REA container past 768 MB. Which process the kernel kills decides the outcome. When it's the analyzer, REA recovers with partial findings, as in the 400 MB test. When it's REA's main process or the adapter, there is no output, giving `infrastructure_error`. A Docker create failure on the HP is the other possibility. 2.4.8 records the exit code and failing step, which will settle it.

## Repair
- `rea-job.mjs`:
  - `reaContainerArgs` takes an optional memory limit (default 768 MB, so ZIP REA is unchanged).
  - The `container_run` phase records the exit code.
  - No readable adapter output adds an `adapter_output` phase, e.g. "container exit 137: killed, likely out of memory".
- `browser-job.mjs`:
  - The website-investigation REA step uses **1 GB** (`REA_BROWSER_MEMORY`). That is bounded by the measurements above, and the HP already runs the 1 GB browser container, which is removed before REA starts.
  - The error names the failing step, e.g. `(REA status infrastructure_error at adapter_output: No readable REA adapter output (container exit 137: killed, likely out of memory).)`.
- **Not changed:**
  - All other REA container flags: no network, read-only, `--cap-drop ALL`, no-new-privileges, user 1000, 64 tasks, 1 CPU, 64 MB noexec tmpfs, `--pull never`.
  - The 384 KB input cap and the 180 s limit.
  - The images: worker, Dockerfiles, proxy and REA adapter are identical to 2.4.5.
  - The website, apart from the download link.

## Verification
| Check | Kind | Result |
|---|---|---|
| `scripts/test-hp-browser-rea.mjs`: 1 GB only for website investigations, ZIP REA args unchanged apart from memory, exit-137 empty output reported with step and code, named error | Docker CLI and REA **mocked** | PASS |
| `test-rea-job`, `test-rea-result`, `test-rea-real` (real REA 6.4.0 in Docker) | mocked / Miniflare / **real Docker** | PASS |
| `test-hp-browser`, `test-hp-runner`, `test-hp-browser-diagnostics`, `test-website-investigation` | mocked / Miniflare | PASS |
| Real end to end (real Chrome capture with non-ASCII script, real proxy, real REA) | **real Linux Docker** | 2/2 complete with REA findings; REA container limit read back as 1024 MB; peak RSS 371–392 MB; no containers left |
| Memory table above | **real Linux Docker** | as listed |
| `tsc`, build, ESLint (0 errors) | local | PASS |
| ZIP integrity | local | 39 files identical to `runner-package/`; 11 mirrored files identical; image inputs identical to 2.4.5 |
| Windows HP | real Windows HP | **NOT RUN, pending** |

## Install on the HP (pairing is kept)
1. Ctrl+C the runner window.
2. Extract `SkyData_HP_Runner_v2_4_8.zip` into a **new** folder.
3. No `Prepare_Browser.cmd` or `Prepare_REA.cmd` needed (images unchanged).
4. Run `Start_Runner.cmd`, retry, type `yes`. If it fails, the message names the step and exit code; send a photo.
