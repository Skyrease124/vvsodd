Runner 2.4.6: no rebuild needed beyond 2.4.5 images (run Prepare_Browser.cmd anyway if you skipped 2.4.5). Fixes website investigations with the REA engine stopping with "timeout · REA capture analysis did not pass integrity checks". The REA step had only 90 seconds, while REA alone needed ~91 s for ~1 MB of minified JavaScript at 1 CPU on Linux Docker. It now uses the same 3-minute REA limit as ZIP REA, sends at most 384 KB of captured JavaScript (the report says how many scripts were analysed), and a REA timeout is reported as a timeout. Linux Docker tested; Windows HP verification pending.

Runner 2.4.5: rebuild with Prepare_Browser.cmd in a new folder (existing pairing is kept). Fixes live investigations failing with "screenshot timed out after 20000ms" on busy pages (2.4.4 only handled slow viewport changes). A screenshot that times out is now skipped and listed as a limitation; slow captures share one 60-second budget per job; a page that stayed busy is not navigated further and the report uses what was collected. Isolation, limits and origin checks are unchanged. Linux Docker tested; Windows HP verification pending.

Runner 2.4.4: rebuild with Prepare_Browser.cmd in a new folder (existing pairing is kept). Fixes live investigations failing with "RPC response timed out after 10000ms: page.set_viewport_size" on heavy pages. Stagehand stops waiting for a viewport change after 10 s while Chrome is still applying it; the runner now waits up to 20 s more (60 s per job in total) for the page to reach the new width. If it never does, only that screenshot is skipped and the report lists it as a limitation. Other errors still stop the investigation. Isolation, limits and origin checks are unchanged. Linux Docker tested; Windows HP verification pending.

Runner 2.4.3: rebuild with Prepare_Browser.cmd in a new folder (existing pairing is kept). Raises the browser container task limit from 128 to 512 processes+threads: on Linux Docker with Chromium 155 the self-test needed about 200 and failed at 128 with fork/pthread EAGAIN. Memory (1 GB), CPU, read-only root, no network except the egress proxy and all origin checks are unchanged. Failed self-tests now report the failing phase, completed checks, probe outcomes and cgroup pids/memory counters. Windows HP self-test passed.

Runner 2.4.2: rebuild with Prepare_Browser.cmd in a new folder. Fixes the Stagehand extension control WebSocket being sent to the public-network proxy. Only ws://127.0.0.1:9222 bypasses; Chrome accepts only the Stagehand extension origin. Every job checks rejected website origins before navigation. HP verification pending.

Runner 2.4.1 startup patch: extract into a NEW folder and run Prepare_Browser.cmd again. Existing pairing is retained. Chrome now uses temporary writable home/config/cache paths; failed self-tests include bounded Chrome startup diagnostics. HP verification is pending.

SKYDATA HP RUNNER v2.4 - OPTIONAL STAGEHAND WEBSITE INVESTIGATIONS

See BROWSER_SETUP_WINDOWS.txt for the new setup. Existing pairing, JavaScript
tests and ZIP REA are kept. Browser support needs Prepare_Browser + a passing
local Browser_Self_Test. Real Windows/browser verification is pending.

PREVIOUS RUNNER NOTES (retained)

SKYDATA HP RUNNER v2.3 - REA STATIC INVESTIGATION (adapter 1) + v2.2 DIAGNOSTICS

v2.3 adds one separate, optional job type: REA static analysis
(rea-agents 6.4.0). See REA_SETUP_WINDOWS.txt. JavaScript test jobs are
unchanged from v2.2. REA support is tested on Linux Docker only; Windows
HP verification is pending.

v2.2 NOTES

STATUS: verified against real Docker on a Linux test machine only.
NOT yet verified on your HP (Windows 11 Home, Docker Desktop, WSL2).

WHAT CHANGED FROM v2 / v2.1
- The 10-second limit now starts when Node begins running your code inside
  the container. Docker start-up has its own separate 60-second limit and
  never runs code. v2/v2.1 started the 10-second clock before Docker had
  started the container, so a slow Docker start could look like a timeout.
- After you type yes, the runner checks that Docker answers (up to 90 s)
  before creating the container. This is not part of the 10-second limit.
- Each test reports timed phases: docker_check, container_create,
  container_start, execution, cleanup, with the exact failing command and
  error code. The website shows them in Test history.
- Cleanup is confirmed with "docker container inspect" after "docker rm -f"
  instead of guessing from rm's error text. If cleanup cannot be confirmed
  the result is still reported as infrastructure_error, but the code's own
  result (passed / failed / timeout) is kept so the two are not confused.
- On a timeout the container itself is killed ("docker kill"), not only the
  docker command-line process.
- No automatic retries. After an infrastructure error the runner stops.

UPDATE
1. In the old black runner window, press Ctrl+C.
2. Extract this ZIP into a NEW folder. Do not launch it inside the ZIP.
3. Keep Docker Desktop running (Linux containers, node:24-alpine cached).
4. Double-click Self_Test.cmd. It writes selftest-report.txt in this
   folder with timings for every Docker phase. The report contains no
   tokens or keys.
5. If all four checks pass, double-click Start_Runner.cmd.
Your existing pairing stays in your Windows user profile; do not pair again
unless the website says the connection expired or was disconnected.
v2.2 also works with the current website; phase timings appear on the
website only after the website update that adds Test history.

ISOLATION (unchanged)
No network, non-root user 1000, read-only root filesystem, all Linux
capabilities dropped, no-new-privileges, 256 MB RAM (no swap), one CPU,
64 processes, 16 MB noexec /tmp, no host folders mounted, no provider keys
or tokens passed in, 60 KB output limit, 10-second execution limit (project
tests: internal Node test runner 8 seconds). Docker isolation is not a
guarantee against every possible container escape.

PROJECT LIMITS
100 selected files / 400 KB of complete source. One JavaScript test entry
runs with node --test and relative imports between selected files. There
is no package installation; imports of npm packages fail with
ERR_MODULE_NOT_FOUND. This is not a whole-project build service.

Stop polling with Ctrl+C. Disconnect HP on the website revokes the token.
Keep the connection file in your user profile private; never share it.
