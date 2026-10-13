# HP runner 2.4.3 — browser task limit and failure diagnostics

Base: published website v116 (commit a9b8242676d239914e90a145e236092acd165814), runner 2.4.2. **Not deployed. Windows HP browser self-test PASSED with runner 2.4.3; a live AI-guided investigation is still unverified.**
Inputs: the v116 source ZIP, the written failure description, and (received afterwards) three photos of the HP's v2.4.2 `browser-selftest-report.txt`.

### Evidence from the HP report photos (v2.4.2 run)
- `error`: `page.goto: net::ERR_ABORTED at https://example.com/` with call log `navigating to "https://example.com/", waiting until "load"`. This is Playwright's format for the **self-test probe** navigation (Stagehand's first navigation uses `domcontentloaded`).
- Chrome logged `DevTools listening on ws://127.0.0.1:9222/...`, then at 04:43:56–57 four `Rejected an incoming WebSocket connection from the https://example.com / http://example.com / null / chrome-extension://aaaa… origin` lines. These are exactly the four origin-guard checks, so **on the HP the guard ran and rejected every unsafe origin**. The report's `controlOriginGuard: false` was the evidence-discarding artifact described below, not a guard failure.
- About 8 seconds later (04:44:05): `zygote_linux.cc:623] Zygote could not fork: process_type renderer numfds 6 child_pid -1`, then `Did not receive ping from zygote child`. `child_pid -1` means the kernel refused the fork for a new **renderer** process. That matches a new probe page needing a renderer, and it is the same failure class reproduced here at the 128-task limit. The log does not print the errno, so it cannot by itself separate task-limit exhaustion (EAGAIN) from memory (ENOMEM); the 2.4.3 report's `pids.events` and memory counters will.
- `probes: []`, `cleanupConfirmed: true`, container and network cleanup ok. The D-Bus errors are present, as in every passing run here.

## Diagnosis

### Confirmed from the source
1. **The failing `page.goto` is the self-test probe, not Stagehand's first navigation.** The initial navigation uses Stagehand `page.goto(target,{waitUntil:'domcontentloaded'})`. The only navigation to `https://example.com/` with Playwright's default `waitUntil:"load"` (as in the reported call log) is `probe.goto('https://example.com/',{timeout:25000})`. It runs after the private-network probes, on a page opened with `newPage()`, which needs a new renderer process forked by Chrome's zygote.
2. **`controlOriginGuard:false` and `probes: []` in the HP report are artifacts.** `executeBrowser` returns `evidence:null` for any non-complete result, and the report computed `controlOriginGuard: result.evidence?.controlOriginGuard===true` and probes from that evidence. A failure therefore always showed `false` and `[]`, whether or not the guard had passed. The guard check runs before any navigation and throws if it fails, so the run reaching `page.goto` implies it had passed.
3. **The probe loop counted any exception as `blocked:true`**, so a crashed or aborted page could be recorded as a successful private-network block.
4. Limits in 2.4.2: browser container `--pids-limit 128`. That limit counts **tasks** (processes plus threads). Memory is 1 GB, 1 CPU, read-only root, 256 MB noexec `/tmp`. `/dev/shm` is Docker's default 64 MB; Stagehand does not pass `--disable-dev-shm-usage`.

### Measured on real Linux Docker (Chromium + Stagehand 4.2.1 + Playwright 1.58.2, your unchanged worker and proxy)
| Setup | Result | Peak tasks (sampled) | `pids.events` (task creations refused) | Peak memory |
|---|---|---|---|---|
| Chromium 155, 128 tasks, 4 CPUs | fail: `pthread_create: Resource temporarily unavailable (11)`, Stagehand init timeout | 128 = limit | 976 → 8,692 | 319 MB |
| Chromium 155, 128 tasks, 2 CPUs (`--cpuset-cpus 0,1`, HP-like) | fail, same signature | 128 = limit | 7,863 | 446 MB |
| Chromium 155, 1024 tasks, 2 or 4 CPUs | **pass**: guard true, 5 probes, cleanup | 197–201 | 0 | 437–447 MB |
| Chromium 155, 256 / 384 tasks, 2 and 4 CPUs (8 runs) | all pass | 196–209 | 0 | 441–455 MB |

The self-test needs roughly 200 tasks, so **128 is exhausted**, and the kernel then refuses new processes and threads with EAGAIN. Chrome reports that as "Zygote could not fork" (a renderer fork) or a `pthread_create` failure. Memory stayed under half of 1 GB and `/dev/shm` stayed free (64 MB total, 64 MB free in the failure snapshot), so neither supports a memory or shared-memory explanation.

### Hypotheses (not proven on the HP)
- **That PID exhaustion is the HP's cause.** It matches "Zygote could not fork" / "Did not receive ping from zygote child", and the failure happening only when the probe page needed a new renderer. On this machine the same limit failed *earlier* (during Stagehand start-up). The HP plausibly got further because its Debian Chromium build and CPU count create fewer threads. The 2.4.3 report now records `pids.events` and memory events on the HP, which will confirm or refute this.
- D-Bus errors appear in every run, including all passing ones, so they are not the cause.

## Repair (focused)
- `runner-package/browser-job.mjs`: browser container `--pids-limit` **128 → 512** (`BROWSER_PIDS`). That is about 2.4× the measured self-test peak, with headroom for extra site-isolated renderers on real pages, and still a hard cap. The proxy stays at 64. Memory (1 GB), CPU (1), read-only root, `--cap-drop ALL`, no-new-privileges, user 1000, noexec tmpfs, internal network, `--pull never`, no host mounts and no host networking are all unchanged. Site isolation was not disabled.
- `browser-service/worker.mjs` (mirrored): tracks the current phase and completed checks (`controlOriginGuard`, initial navigation status, self-test navigation status, resource snapshots). On error it emits `failingPhase`, `completedChecks`, the probes so far and a resource snapshot. The two self-test steps are named phases ("Self-test private-network probes", "Self-test public navigation"). A probe is **blocked only when the egress proxy answered HTTP 403**; errors are recorded and count as not blocked. Origin checks, the proxy bypass (`ws://127.0.0.1:9222` only) and the exact extension origin are unchanged.
- `browser-service/resource-diagnostics.mjs` (new, mirrored): bounded cgroup v2/v1 PID and memory counters and events, process/thread counts from `/proc`, and `/dev/shm` and `/tmp` sizes. Values that can't be read are `null`.
- `browser-job.mjs`: keeps that failure context (bounded to 6 KB, 64-hex tokens redacted). The self-test report now includes `failingPhase`, `completedChecks`, `resources`, probe outcomes, `configuredBrowserPidsLimit`, and `controlOriginGuard` as `true` / `false` / `"not_reached"`. Evidence is still withheld for failed runs.
- `runner.mjs`: version 2.4.3. A failed live job prints the failing phase and task counters in the runner window. **The website receives the same result fields as before** (the failure context stays on the HP).
- Docs: `README.txt` and `BROWSER_SETUP_WINDOWS.txt` notes; the runner page links the 2.4.3 ZIP.
- Not changed: website APIs and validation, Stagehand and adapter versions (4.2.1 / "2", so pairing and capability checks are unaffected), proxy, URL policy, ZIP investigations, REA, Superpowers, chat, models, voice, Polly, Chill Mode, authentication, ownership, hosting.

## Verification
| Check | Kind | Result |
|---|---|---|
| `scripts/test-hp-browser-diagnostics.mjs` (new) | Docker CLI and worker **mocked** | PASS — 512/64 limits with other flags unchanged, failure context retained and redacted, website result fields unchanged, guard `true` vs `"not_reached"`, crashed probe not blocked |
| `browser-service` unit tests (`node --test`, 9 existing + 1 new) | local | 10/10 PASS |
| `test-hp-browser`, `test-hp-browser-worker`, `test-website-investigation`, `test-website-unavailable`, `test-hp-runner`, engineering, model selection, Polly worker, REA (incl. real REA in Docker), project/runner suites | mocked / built Worker + Miniflare / real Linux Docker as labelled | PASS |
| 12 other suites (knowledge ×6, Blender, camera ×2, conversation style, reveal mode, Polly unit) | local | fail **identically on pristine v116** (environment-specific); unrelated |
| `tsc --noEmit`, `npm run build` | local | PASS |
| ESLint, changed files | local | 0 errors; same 3 pre-existing warnings |
| **Real self-test, runner code from the extracted 2.4.3 ZIP** | **real Linux Docker + real Chromium 155** | 4/4 PASS (2 CPUs ×3, 4 CPUs ×1): guard true, 4 probes answered 403 + POST blocked, cleanup confirmed, peak ~200 tasks, `pids.events` 0, ~450 MB |
| Same with the limit forced to 128 | real Linux Docker | fails as on the HP class of error; report shows failing phase, guard `"not_reached"`, `pids.events` > 0 |
| ZIP integrity | local | 39 packaged files = `runner-package/` byte-for-byte; 11 mirrored browser-service files = `browser-service/` |
| **Windows HP self-test (runner 2.4.3, Prepare_Browser.cmd)** | **real Windows HP** | **PASS** (owner's screenshot, 2026-10-13): "Browser self-test passed: real public Chromium load, two viewport screenshots, private request probes and cleanup." Both images rebuilt; setup reported passed. |
| Live AI-guided website investigation on the HP | live | **NOT RUN — still unverified** |

Limits of this verification: this sandbox cannot reach Debian mirrors or the public internet from containers. The Chromium was Google Chrome for Testing 155.0.8059.39 (not Debian's `chromium` package) in a test-only image assembled from host libraries, with the same worker, labels, user, environment and Docker flags. The proxy was your unmodified `proxy.mjs`, with only `example.com`'s DNS answer pointed at a local HTTPS fixture. The fixture build files are not shipped.

## Install on the HP (pairing is kept)
1. Stop the old runner window (Ctrl+C).
2. Extract `SkyData_HP_Runner_v2_4_3.zip` into a **new** folder.
3. Keep Docker Desktop running, then double-click `Prepare_Browser.cmd` (rebuilds both images and runs the self-test).
4. If it fails, send `browser-selftest-report.txt`. It now shows the failing phase, completed checks and the `pids`/memory counters, and contains no tokens.
5. When it passes, double-click `Start_Runner.cmd`. Do not pair again.
