SKYDATA HP RUNNER v2.2 - DOCKER PHASE DIAGNOSTICS

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
