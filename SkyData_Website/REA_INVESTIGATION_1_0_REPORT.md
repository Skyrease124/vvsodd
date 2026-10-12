# REA Investigation 1.0 — change report

Base: `SkyData_Website_v107_candidate_r2` (Engineering Workspace 1.0, HP Runner v2.2). **Not deployed. Windows HP verification pending.**

## REA investigation (before implementing)
| Question | Finding |
|---|---|
| Source and licence | github.com/morluto/rea, MIT (`LICENSE`, copyright 2026 morluto). |
| Pinned version | **rea-agents 6.4.0** (npm; tag `rea-agents-6.4.0`, commit a56f7bb6). Tarball SHA-256 `59eb1604…db9b8`, npm integrity `sha512-Vj1zWfSl…`. |
| Released vs main | `main` is **350 commits ahead** of 6.4.0. Source and docs were read at the 6.4.0 tag; only released behaviour is used. |
| Tool used | Released CLI `rea analyze-javascript-application <dir> --artifact-format directory --format json --max-heap-mb --analysis-timeout-ms` (MCP equivalent `analyze_javascript_application`). Its documentation says target code is parsed as inert text and never executed. |
| What it returns | JavaScript Application Graph: modules/assets, `imports` edges (static, dynamic, `require`), endpoint nodes (routes and network calls, e.g. `call:app.get`, `call:fetch`), storage, `loads` entrypoints, explicit `unknown` scopes, coverage (`complete`/`partial`/…), limitations, exact `source-range` locations, evidence ID. |
| Install behaviour | 144 dependency packages; **none declares an install script** (checked in the lockfile). Installed with `npm ci --ignore-scripts` from a generated `package-lock.json` (149 integrity entries), since the tarball ships no lockfile. |
| Windows | REA's documented host baseline is macOS 12+ and named Linux distributions; Windows appears only as an *experimental* Ghidra path. SkyData therefore does **not** run REA on Windows: it runs in a Linux container on Docker Desktop. |
| Undocumented prerequisite found | REA 6.4.0 refuses to start its owned analyzer without a procps-compatible `ps` (`capability_unavailable … spawn ps ENOENT`). The slim Node image lacks it; the image copies `ps` + `libproc2` (Debian procps 2:4.0.2-3) and its copyright file from the digest-pinned `node:24-bookworm` image. |
| Licence files | The image keeps REA's shipped licence files (`LICENSE`, `third_party/evmole/LICENSE`, `third_party/pwndbg/LICENSE.md`, `licenses/nativeaot-parser-MIT.txt`) in `/opt/rea/licenses` and procps's copyright file; `rea/REA-6.4.0-LICENSE` ships in the runner package. |
| Observed REA limitations | Labels a plain `package.json` `main` entry `electron-main`; does not compose `app.use('/prefix', router)` with router routes; merges identical endpoint values into one node (call sites keep the method). Shown in the UI as REA's own classification. |

## Design
- **Separate job type.** `SKYDATA_REA_V1` payload prefix; `validJob` (test jobs) explicitly rejects it. One operation only; no user-supplied commands or arguments; the container's fixed entrypoint is the adapter.
- **Separately versioned adapter.** `runner-package/rea/` = REA adapter **1** (`adapter.mjs`, `Dockerfile`, pinned `package.json`/`package-lock.json`). Image `skydata-rea:6.4.0-a1`, labelled `org.skydata.rea.version=6.4.0`, `org.skydata.adapter.version=1`, user `1000:1000`. The runner verifies these labels, the user and the entrypoint before every job; jobs use `--pull never` and the verified image ID. Nothing is downloaded during a job.
- **Isolation (same controls as tests).** `--network none`, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, user 1000, `--pids-limit 64`, `--cpus 1`, 64 MB noexec tmpfs, `--log-driver none`, no mounts or environment. Memory is **768 MB** (REA's analyzer needs a 384 MB V8 heap) instead of 256 MB; REA jobs have a **180 s** deadline (per-source analysis 60 s). JavaScript tests keep 256 MB and the 10-second execution limit unchanged.
- **Inputs.** Complete originals read from the stored ZIP; ≤ 200 files, ≤ 1 MB total (kept under D1's value limit for the queued payload), ≤ 512 KB per file; JS/TS/JSON/HTML only. Excluded with reasons: unsafe paths, symlinks (new detection from ZIP external attributes), duplicates and case collisions, dependency/runtime folders, credential-like names, non-source, oversized. Unselected packages/relative imports are listed as omitted.
- **Approval chain.** Website preview → approval bound to the preview's SHA-256 fingerprint → job claimable **only** by a runner whose last poll reported a verified REA 6.4.0 / adapter 1 image → runner re-checks the image, shows operation and file list (`show` prints sources) → local `yes`.
- **Results.** Adapter verifies REA's reported version, stages files in tmpfs, runs REA, re-hashes the workspace (detects any write such as an execution canary) and returns only projections of REA's records with bounded lists. Server checks staged files = approved files, stores the result in R2 under the project, keeps a summary in history. Results are labelled "reported by the paired HP runner; not independently verified".
- **AI explanation.** `investigation:'rea'` + `reaRunId` sends the stored findings to the **existing model selection** (actual backend unchanged: Gemini) as untrusted tool data; the response is labelled "AI interpretation … not REA output". Superpowers is the default and unchanged; `ENGINEERING_WORKFLOWS` is untouched.

## Files changed (vs r2, commit 1e6f34b)
New: `lib/rea-selection.ts`, `lib/rea-explain.ts`, `app/engineering/rea-panel.tsx`, `runner-package/rea-job.mjs`, `runner-package/rea/{adapter.mjs,Dockerfile,package.json,package-lock.json,REA-6.4.0-LICENSE,fixture/*}`, `runner-package/{Prepare_REA.cmd,REA_Self_Test.cmd,REA_SETUP_WINDOWS.txt}`, `public/SkyData_HP_Runner_v2_3.zip`, `scripts/test-rea-job.mjs`, `scripts/test-rea-real.mjs`, this report.
Modified: `lib/engineering-runner.ts` (REA capability table, capability-gated claim, `rea-preview`/`rea-analyze`/`rea-run`, device `rea-result`, `/result` refuses REA jobs, REA statuses), `lib/engineering.ts` (separate REA branch), `lib/project-archive.ts` (symlink flag; directory cache v2 — browsing/packaging behaviour unchanged), `build/sites-worker.ts` (device route `rea-result`), `runner-package/runner.mjs` (v2.3: REA dispatch, `rea-selftest`; test path unchanged), `runner-package/README.txt`, `app/engineering/page.tsx` (method selector, REA panel), `app/engineering/runner/page.tsx` (v2.3 download link), `app/engineering/runner/runner-panels.tsx` (REA history labels), `app/engineering/engineering.css`, `eslint.config.mjs` (ignore the deliberately invalid REA fixture).
Not changed: authentication, owner/membership checks, models, chat, voice, Amazon Polly, AWS permissions/credentials, storage bindings, secrets, hosting configuration.

## Verification
| Check | Kind | Result |
|---|---|---|
| `tsc --noEmit`, `npm run build` | local | PASS |
| ESLint, touched files | local | new files clean; error counts on touched files identical to r2 (pre-existing lines only) |
| 11 existing test scripts (engineering, runner, workspace, diff, real-Docker isolation) | local / mocked / real Linux Docker as labelled | PASS |
| `test-rea-job.mjs` | **mocked** docker CLI | PASS — payload validation, REA ≠ test job, fixed args, missing/incompatible image, timeout with hung kill, output limit, failed cleanup, malformed output, HP decline |
| `test-rea-real.mjs` | **real REA 6.4.0 in real Docker** + built Worker (Miniflare D1/R2) + runner `reaJob` | PASS — owner/member/origin, exclusions, fingerprint-bound approval, capability-gated claim, staged = approved, no execution (workspace unchanged, no canary), partial coverage + unknowns, routes/imports/storage with exact locations, cleanup confirmed, adapter rejections in the real container, real deadline with confirmed kill, AI explanation labelled (Gemini mocked), Superpowers default unchanged |
| Extracted `SkyData_HP_Runner_v2_3.zip`: image build + `rea-selftest` + `selftest` | real Docker, Linux | PASS (15/15 REA checks; 4/4 test checks) |
| Browser (Playwright, built Worker under local Wrangler, real REA via `reaJob`) | local | PASS — default Superpowers, preview, approval, findings with locations, 390 px with no horizontal scroll, no page errors |
| Windows HP: `Prepare_REA.cmd` build, REA self-test, live job | live | **NOT RUN — Windows verification pending** |
| Live website | — | **NOT DEPLOYED** |

Simulated in automated tests: the HP machine itself and the typed `yes`. The sandbox needed an extra CA build secret (optional in the Dockerfile) because its network intercepts TLS; package integrity is still enforced by the lockfile.
