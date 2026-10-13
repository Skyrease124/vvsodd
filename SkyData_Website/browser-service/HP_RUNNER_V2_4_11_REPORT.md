# HP runner 2.4.11: REA results over 64 KB were cut off

Base: runner 2.4.10. **Not deployed. Linux Docker tested; Windows HP verification pending.** No website change, apart from the download link; the report JSON fix is still waiting to be published.

## What the HP showed (runner 2.4.10, https://cinejoy.pk/, engine REA)
- First investigation (`1c933b4f…`): **complete**.
- Second (`66bf1bdb…`): `REA status infrastructure_error at adapter_output: No readable REA adapter output (container exit 0)`.

## Diagnosis
- **Confirmed (source):** the REA adapter ended with `process.stdout.write(JSON.stringify(result)); process.exit(…)`. When stdout is a pipe and the result is larger than the pipe buffer, `process.exit` discards the unwritten rest. This bug was in the adapter since its first version (mine). It only showed once results grew: larger sites and the longer 2.4.10 REA time give REA more to report.
- **Reproduced (real Docker, REA image, the runner's exact read path `docker create -i` + `docker start -a -i`):**
  - The old pattern delivered **65,536 bytes** for 0.2, 1 and 3 MB results, in 6/6 runs.
  - The fixed pattern delivered everything, in 6/6 runs.
- **Reproduced with the real adapter and real REA:** 20 module files (244 KB) with many imports and API calls.
  - 2.4.10 image: `No readable REA adapter output (container exit 0: output cut off at 64 KB)`.
  - Fixed image: a 222 KB result read in full.
- **Reproduced end to end:** real Chrome captures those 20 scripts, then real proxy and real REA.
  - 2.4.10 image: the HP's error.
  - Fixed image: **complete**, 20 scripts staged and REA findings.

## Repair
- `rea/adapter.mjs` (**REA image changes; run `Prepare_REA.cmd`**): replies with `process.stdout.write(json, () => process.exit(code))`, so it exits only after the output is flushed. The request handling is otherwise unchanged.
- `rea/Dockerfile`: label `org.skydata.rea.output-flush="1"`.
- `rea-job.mjs`: reports the label. "No readable output" with exit 0 and exactly 65,536 bytes is described as "output cut off at 64 KB".
- `browser-job.mjs`: on that error with an unlabelled image, adds "Run Prepare_REA.cmd once: older REA images cut off results larger than 64 KB."
- Not changed: REA isolation, limits (1 GB / up to 330 s for website investigations; ZIP REA 768 MB / 150 s), the browser image and the website.

## Verification
| Check | Kind | Result |
|---|---|---|
| `test-hp-browser-rea` (adds: cut-off detection message, hint only with an unlabelled image) | **mocked** | PASS |
| `test-rea-job`, `test-hp-browser`, `test-hp-runner`, `test-hp-browser-diagnostics`, `test-hp-browser-worker`, `test-website-investigation` | mocked / Miniflare | PASS |
| `test-rea-real` (ZIP REA through Worker + real REA), `node runner.mjs rea-selftest` | **real Docker**, fixed image | PASS |
| Write/exit pattern, real adapter, end to end, as above | **real Linux Docker** | old image cut off at 64 KB; fixed image complete |
| REA image built from `rea/Dockerfile`; its adapter is byte-identical to the ZIP's | real Docker build | PASS |
| `tsc`, build, ESLint (0 errors) | local | PASS |
| ZIP integrity | local | 39 files identical to `runner-package/`; browser image inputs unchanged |
| Windows HP | real Windows HP | **NOT RUN, pending** |

## Install on the HP (pairing is kept)
1. Ctrl+C the runner window.
2. Extract `SkyData_HP_Runner_v2_4_11.zip` into a **new** folder.
3. Run `Prepare_REA.cmd` (internet once; rebuilds REA and runs its self-test). `Prepare_Browser.cmd` is not needed.
4. Run `Start_Runner.cmd`, retry, and type `yes`.
