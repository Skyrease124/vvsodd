Runner 2.5.0: extract into a NEW folder, then run Pair_Runner.cmd (pair again from Engineering -> Runner on this site), Prepare_REA.cmd and Prepare_Browser.cmd once.
- Connects to the SkyData site on Netlify (https://845-nbny-v36.netlify.app). Runners up to 2.4.11 had the old ChatGPT Sites address built in, so they kept working with the old site and never picked up jobs from this one. The pairing now records which site it belongs to; a runner paired with another site says so and asks you to pair again instead of polling the wrong site. (SKYDATA_SITE_URL can point a runner at another SkyData copy.)
- REA 6.5.0 (was 6.4.0). Prepare_REA.cmd builds skydata-rea:6.5.0-a1; the site only accepts REA 6.5.0 results from now on.
- ZIP REA analyses get 1 GB of memory (was 768 MB), like website investigations. REA 6.5.0 sizes its result budget from the container's memory: at 768 MB it skipped analysing several files (fewer endpoints and imports than 6.4.0); at 1 GB it found as much as 6.4.0 or more (on a 32-file project: 142 imports and 161 modules vs 63 and 81).
- Prepare_Browser.cmd is needed once: the egress proxy now relays the browser's AI calls to the site the runner is paired with (it had the old address built in). Until it is rebuilt, website investigations report the proxy image as incompatible.
Linux Docker tested (real REA 6.5.0 image; runner paired with a local copy of the Netlify site); Windows HP verification pending.

Runner 2.4.11: run Prepare_REA.cmd once in the new folder (the REA image changes; pairing is kept; Prepare_Browser.cmd is not needed). Fixes REA results larger than 64 KB being cut off ("No readable REA adapter output (container exit 0)"): the REA adapter exited before its output was fully written. Larger sites and the longer REA time limit produce larger results, which made this more likely. Linux Docker tested; Windows HP verification pending.

Runner 2.4.10: run Prepare_REA.cmd once in the new folder (the REA image changes; pairing is kept; Prepare_Browser.cmd is not needed if 2.4.9's passed). Website investigations with the REA engine now give REA the time left in the website's 10-minute job window, up to 330 seconds instead of 150. On a slow PC most REA time is fixed start-up, so a larger time limit helps where smaller inputs do not. ZIP REA analyses keep 150 seconds. Until Prepare_REA.cmd is run, the old limit applies and the timeout message says so. Linux Docker tested; Windows HP verification pending.

Runner 2.4.9: run Prepare_Browser.cmd once in the new folder (the browser image changes; pairing is kept). If the AI navigation relay fails (for example "Browser reasoning relay failed: 502" or a Gemini quota limit), the investigation no longer fails: it stops clicking further, keeps the pages, screenshots and scripts already collected, runs REA as usual and states the limitation in the report. No retry is made. Other errors still stop the investigation. Linux Docker tested; Windows HP verification pending.

Runner 2.4.8: no image rebuild needed. For website investigations with the REA engine: the REA container now gets 1 GB instead of 768 MB. On Linux Docker, REA used 710 MB plus 33 MB of temporary files (97% of 768 MB) for 348 KB of real minified JavaScript, so heavier sites could fail. ZIP REA analyses keep 768 MB. When REA returns no usable output, the error now names the failing step and container exit code (137 = killed, likely out of memory). Linux Docker tested; Windows HP verification pending.

Runner 2.4.7: no image rebuild needed if 2.4.5's Prepare_Browser.cmd passed. Fixes website investigations with the REA engine failing with "REA capture analysis did not pass integrity checks" on sites with non-English text or emoji in their JavaScript. The runner decoded the browser container's output chunk by chunk, so a multi-byte character split between chunks was corrupted and the captured script no longer matched its SHA-256 fingerprint; REA then correctly refused it. Output is now decoded as one stream (browser and REA). The error also names the check that failed. Linux Docker tested; Windows HP verification pending.

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
