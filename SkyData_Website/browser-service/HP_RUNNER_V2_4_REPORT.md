# SkyData Stagehand — HP runner v2.4

Base: saved candidate version 113 (`aeee7b8da1793d96b0b9cd46351bc3d9c2ebee7c`); live baseline version 112. The implementation now reuses the existing paired Windows HP runner instead of requiring a newly hosted browser service.

## Delivered implementation

- HP runner v2.4 keeps the existing pairing in the user's profile. Existing Node test jobs and ZIP REA remain separate.
- `SKYDATA_BROWSER_V1` is a separate queued job type. Older runners cannot claim it, and it is refused by the JavaScript test validator/result endpoint.
- The website sends URL, goal and chosen investigation engine; both website approval and local typed `yes` are required.
- One-time `Prepare_Browser.cmd` builds Stagehand 4.2.1 adapter 2 and public-egress gateway adapter 2 images. The browser is Chromium inside Docker Desktop's Linux VM. No npm install on Windows or new cloud hosting account is required.
- `Browser_Self_Test.cmd` tests actual public HTTPS load, two viewport screenshots, private-destination probes through the gateway, and cleanup. Its saved success is bound to exact local image IDs and expires after seven days. It does not test inference; the first live URL job is still required.
- One temporary internal Docker network and two containers per job. Only the gateway gets an external route. No host mounts or paired runner/provider credentials enter the browser container.
- The gateway terminates HTTPS using an isolated job certificate, validates real upstream TLS, pins public DNS answers, and rejects private/reserved/metadata addresses. It blocks non-GET/HEAD, WebSockets, cookie/auth forwarding, media types and downloads even when browser request interception is bypassed. No certificate is installed in Windows or the user's normal browser.
- Native Chromium sandbox is disabled in this Docker configuration. Isolation is provided by the non-root read-only container, dropped capabilities, no-new-privileges, internal network and explicit resource limits. This must still be exercised on the real HP; tests do not establish immunity to browser/container vulnerabilities.
- Browser navigation inference uses a short-lived job-scoped token, three calls maximum, through SkyData's existing Gemini connection. The Google key stays on the website server. The final report uses the existing selected text model. No paid fallback is enabled.
- Cancellation is polled every five seconds while waiting for approval/running. Relay permission is immediately revoked on cancellation. Browser cleanup failure stops the runner. REA is killed on cancellation; its wait is bounded separately.
- For REA, captured eligible public JavaScript is hashed and analyzed by the existing network-none REA 6.4.0 adapter. Matching staged paths/hashes, version, operation, findings, unchanged workspace and confirmed cleanup are required. Superpowers uses the browser evidence with its unchanged workflow.
- Reports and screenshots remain owner-scoped in R2. Browser results must match the approved URL/goal/engine fingerprint. Result replay is refused. Findings are explicitly HP-reported observations, with model interpretation separate.

## Files changed

New: `lib/hp-browser.ts`, `runner-package/browser-job.mjs`, `runner-package/Prepare_Browser.cmd`, `runner-package/Browser_Self_Test.cmd`, `runner-package/BROWSER_SETUP_WINDOWS.txt`, `runner-package/browser-service/{package.json,package-lock.json,worker.mjs,proxy.mjs,url-policy.mjs,Dockerfile,Dockerfile.proxy}`, `public/SkyData_HP_Runner_v2_4.zip`, `scripts/test-hp-browser.mjs`, `scripts/test-hp-browser-worker.mjs`, `browser-service/test/https-policy.test.mjs`, this report.

Modified: `lib/engineering-runner.ts`, `lib/website-investigation.ts`, `build/sites-worker.ts`, `runner-package/runner.mjs`, `runner-package/README.txt`, `app/engineering/{website-panel.tsx,engineering.css}`, `app/engineering/runner/{page.tsx,runner-panels.tsx}`, browser adapter/gateway files and Dockerfiles in `browser-service/`, and the unavailable-status regression assertion.

No existing ZIP parsing, file selection, proposal packaging, JavaScript test execution limits, REA adapter source, models, chat, Chill Mode, voice/Polly, membership policy or live provider credentials were changed. Engineering remains owner-only. Existing pairing and v2.3 downloads remain available.

## Dependencies / execution / costs

Same separate browser-package dependencies as candidate 113: Stagehand 4.2.1, playwright-core 1.58.2, ipaddr.js 2.2.0, zod 4.4.3, integrity lockfile and `npm ci --ignore-scripts`. Root website dependency inputs unchanged. Gateway image adds Debian OpenSSL/CA certificates; browser image adds Debian Chromium. The two images are built once on the HP, then verified and used by immutable image ID with `--pull never`.

Browser container: 1 GB RAM/swap, 1 CPU, 128 PIDs. Gateway: 256 MB RAM/swap, 1 CPU, 64 PIDs. Read-only roots, no host mounts, 256 MB noexec tmpfs, non-root user 1000, no-new-privileges, no capabilities. Browser attach: 180 seconds; REA analysis: 90 seconds; Docker setup/cleanup separately bounded. The browser is removed before REA starts.

No Browserbase subscription or new server rent for this HP path. The HP must remain powered on, online, with Docker/runner open. Costs can include existing AI quota/billing, electricity, bandwidth and existing website storage. Browser inference requests are capped at three calls with 2048 output tokens each; real provider input/output usage is recorded. No paid service/account has been enabled.

## Verification status

- TypeScript and site build: PASS.
- New HP job contract tests: PASS with Docker CLI mocked. Covers validation, job-type separation, self-test/image identity, fixed isolated arguments, network topology, success/timeout/cancel/output cap, failed cleanup and local decline.
- New built Worker/Miniflare D1/R2 flow: PASS with HP/browser and Gemini simulated. Covers old-runner claim refusal, website/local phase approval, scoped relay/key isolation, three-call budget, result fingerprint/replay, report persistence, cancellation, invalid evidence and refused browser-only REA result.
- Real local proxy/TLS socket tests: PASS. A real CONNECT/TLS session is used to confirm HTTPS POST, host-smuggling and WebSocket rejection. DNS answers in this test are controlled; this is not a real Chrome test.
- 16 built-Worker/non-Docker integration and regression scripts: PASS. Two real Docker suites: SKIPPED because Docker is unavailable; not counted as passes. The separate HP contract test and six proxy/SDK policy tests also PASS, with the mocking boundaries described above.
- Packaged runner files compared byte-for-byte to source: 35 files, zero mismatches.
- Real Windows HP/Chromium/Stagehand navigation: NOT RUN by the developer. Docker/Chromium are absent in this execution environment. Do not call the feature live-tested until the user's self-test and first website job pass.
- Browser/mobile UI QA: NOT RUN (browser-control capability unavailable). Existing styling retained; no responsive verification claim.

## Limits

Public navigation links only; search submissions, playback tests and full accessibility/performance audits remain unavailable. Public scripts are a partial subset (20 responses, 1 MB total); some sites will not provide analyzable scripts and REA will report that honestly. No private backend/source/DRM/authorized media licensing can be deduced from frontend observations. Model recommendations/GitHub links are advice, not verified repository research.

The v113 standalone hosted-service prototype is superseded by this paired-HP path. The website does not need a public HP port or tunnel: it queues jobs and the HP polls outward. No external integrations are activated.
