## Current implementation: existing HP runner v2.4

Use `runner-package/BROWSER_SETUP_WINDOWS.txt` and `HP_RUNNER_V2_4_REPORT.md`. The paired HP polls SkyData outward; no new hosting or inbound PC port is required. Provider keys stay on the website server via a scoped model relay. The standalone service instructions below describe the superseded v113 candidate and are not the active HP setup.

# SkyData Stagehand integration candidate — NOT OPERATIONAL / NOT DEPLOYED

This is an additive implementation candidate against SkyData v112. It is not a verified production browser service. Keep the Site activation flag unset until the tests below pass on the actual isolated deployment. Backend flags may be enabled only on an isolated staging service to run those tests, then enabled on production after verification.

## Architecture and integration points

- Existing primary runtime: Cloudflare Workers (128 MB isolate); no Chromium process or Docker daemon. D1 is `DB`; R2 is `FILES`.
- Existing APIs remain in `build/sites-worker.ts`, rather than `app/api`.
- Superpowers remains the existing reasoning workflow in `lib/engineering.ts` and `lib/engineering-skills.ts`.
- REA remains the real pinned 6.4.0 static analyzer, `runner-package/rea/adapter.mjs`. Existing HP jobs, ZIP file selection, validation, fingerprints, proposals and corrected ZIP packaging are untouched.
- ZIP validation remains `lib/project-archive.ts`, `lib/project-workspace.ts`, `lib/projects.ts`. The website branch has its own inputs; it does not create or replace ZIPs.
- Existing text models and stored keys remain configured by `lib/models.ts`, `lib/nvidia.ts`, `lib/gemini-provider.ts`, `lib/secret-store.ts`. Final reports use the selected existing model. Browser planning uses a separately provisioned copy of the existing Gemini credential through Stagehand's documented custom-model callback. This copy is required on the hosted worker; credentials are not transferred through the frontend or automatically copied.
- New UI `app/engineering/website-panel.tsx` sits behind an independent source selector. Current Engineering access remains owner-only. This release does NOT broaden membership permissions.
- New connector `lib/website-investigation.ts`: `/api/engineering-browser/status`, POST/GET base route, GET/DELETE `/:id`, POST `/:id/generate`, GET `/:id/report`, GET `/:id/screenshot?index=N`.
- D1 `engineering_browser_jobs` is initialized using the existing runtime table pattern. Reports and screenshots are owner-scoped in R2. Retrying generation returns an already saved report without another inference call. No stale cross-user website cache is used.
- The separate host's authenticated service has a single browser slot, a 180-second overall deadline and 50 in-memory jobs, expiring after an hour when new jobs arrive. Saved site reports survive host restarts; unfinished backend jobs do not.

## Pinned dependencies and official API

Installed in this separate package, not the Worker bundle:

- `@browserbasehq/stagehand` **4.2.1** (latest npm stable returned on 2026-10-13)
- `playwright-core` **1.58.2** (CDP request policy and network observation)
- `ipaddr.js` **2.2.0**
- `zod` **4.4.3** (Stagehand v4 dependency/contract)

`npm install --ignore-scripts` generated the committed integrity lockfile; builds use `npm ci --ignore-scripts`. Released package declarations were inspected and the public custom-model contract tested. Uses v4 `localBrowser.launch`, `Stagehand.create`, `observe`, `act`, `page.goto`, `evaluate`, `setViewportSize`, `screenshot`, `close`. No Browserbase account, cloud session or model gateway is used.

Official references: https://github.com/browserbase/stagehand, https://docs.stagehand.dev/v4/configuration/browser, https://docs.stagehand.dev/v4/configuration/models.

## Intended hosting topology

A dedicated Linux VM or equivalent Docker-capable backend, separate from SkyData's primary runtime:

1. Node 24.19+, Docker and Compose on the host. A preliminary capacity target is 2 CPU / 4 GB RAM; this is a sizing assumption to validate, not a measured requirement or hosting quote.
2. Browser job container: 1 CPU, 1 GB RAM, 128 PIDs, read-only root, no host mounts, non-root uid 1000, all capabilities removed, no-new-privileges, 256 MB noexec tmpfs. Chromium's native sandbox is disabled for this Docker configuration; container isolation is NOT equivalent to Chromium's native sandbox. A hardened runtime (e.g. gVisor) and deployment security review remain required before enabling hostile-site browsing.
3. Internal Docker network, no direct internet route. Only the dedicated egress proxy has an outbound route. Proxy accepts public HTTP(S), refuses private/reserved/metadata addresses, rejects mixed DNS results, and connects to the validated literal address. Redirects and subresources establish new validated connections. No proxy port is published to the internet.
4. Browser request policy blocks non-GET/HEAD, WebSockets, media and downloads. This policy is defense in depth: HTTPS CONNECT is not decrypted by the proxy. Service-worker, new-target and non-HTTP egress behavior must be verified with real adversarial browser tests before activation. Unit tests alone do not establish complete egress confinement.
5. REA runs in a separate network-none container after browser capture, using the existing `skydata-rea:6.4.0-a1` image. Hashes and staged paths must match captured script metadata; cleanup and unchanged workspace are required. Captured source is discarded from backend status payloads. Public scripts do not reveal server source.
6. Node service listens on 127.0.0.1:8788. Put an HTTPS reverse proxy in front; restrict access and require the service token. Do not expose Docker's socket, Chrome CDP, or unauthenticated service routes. Run the service under a dedicated operator account. Access to Docker is privileged infrastructure access.

From repository root, on that dedicated host:

```sh
npm ci --ignore-scripts --prefix browser-service
docker build -f browser-service/Dockerfile -t skydata-stagehand:4.2.1-a1 .
docker build -f runner-package/rea/Dockerfile -t skydata-rea:6.4.0-a1 runner-package/rea
docker compose -f browser-service/compose.yaml up -d --build
# Provision secrets securely in the service manager; never commit an env file.
node browser-service/server.mjs
```

The Chromium Debian package and base image tags are not yet digest-pinned; record and pin tested digests and Chromium version before production deployment. These builds have NOT been run here because Docker is absent.

## Configuration — backend secrets only

Host service: `SKYDATA_BROWSER_SERVICE_TOKEN` (random >=32 characters), `GEMINI_API_KEY`, `GEMINI_FREE_TIER_CONFIRMED=true` ONLY when its usage budget is actually approved, optional `STAGEHAND_MODEL` (default existing `gemini-3.8-flash`).

Only after actual deployment verification: `SKYDATA_BROWSER_VERIFIED=true`; independently `SKYDATA_REA_VERIFIED=true` after the hosted REA path passes.

Site runtime: `SKYDATA_BROWSER_SERVICE_URL` (HTTPS origin), matching `SKYDATA_BROWSER_SERVICE_TOKEN`, and only after verification `SKYDATA_BROWSER_ENABLED=verified`.

None of these secrets or flags has been added to the live site. Without configuration the new API returns an honest unavailable status and launches nothing. No automatic provider signup, subscription, paid fallback or resource creation occurs.

## Intended capabilities and honest limits

Up to 3 public pages; Stagehand AI selects relevant same-origin navigation links. Collect visible structure, titles, bounded text, public metadata, player elements, partial script responses with SHA-256, bounded network metadata, limited navigation timing and accessibility observations. Capture 1440 px and 390 px screenshots and horizontal overflow observations. Report generation receives this actual record as untrusted data and requests confirmed / likely / unknown classifications.

Not yet covered: search submissions, non-link menus, playback testing, authenticated flows, CAPTCHA/DRM bypass, media downloads, full accessibility/performance audits, verified GitHub project discovery, token billing reconciliation, peak-memory telemetry, durable hosted-job recovery, report/evidence export as one archive, or a complete automatic deployment. Suggested open-source links are model advice, not verified repository research. Reports are AI interpretations of backend-reported evidence, not independently confirmed server architecture.

There is no arbitrary user command or browser-agent loop. Browser inference has a 3-call budget, 2048 output tokens/call, no retry loop; reported browser input/output token counts are retained. The current final-report handler does not expose token totals, so report token usage and price are unknown. An administrator must enforce provider spending limits. Final report responses request at most 8192 tokens.

## Costs before deployment

Open-source software requires no subscription. Actual costs can include the dedicated always-on host, HTTPS/domain if needed, bandwidth, report/screenshot R2 storage, D1 requests and provider inference. Existing free quotas may cover some usage, but availability is not guaranteed. No host/provider was selected, so a recurring bill cannot be quoted honestly. The user's HP is not required once a compatible hosted backend exists. This implementation does not provide free hosting by itself.

## Required real deployment verification

Do not enable flags based on mock tests. On the actual dedicated host:

- Build images, record image digests/Chromium version; verify user, entrypoint and labels.
- Run `node browser-service/test-real.mjs` with `SKYDATA_BROWSER_TEST_ENDPOINT`, the service token, and `SKYDATA_BROWSER_FIXTURE_URL` set to an authorized public test site. It exercises both engines; it does not substitute for adversarial confinement or final Sites report tests.
- Launch a real browser job against an authorized public fixture, with real provider inference; confirm navigation, Stagehand observe/act, two viewport screenshots and token counts.
- Run BOTH Superpowers and real REA through the website connector; confirm actual selected report provider receives captured evidence.
- Test initial URLs, redirects, subresources, frames, popups, service workers, websockets, encoded IPv4, IPv6, DNS rebinding and cloud metadata/private networks. Confirm the isolated container cannot bypass the egress proxy or reach primary application infrastructure.
- Exercise timeout, cancellation during create/browser/REA, killed Docker CLI, output caps, crashes, failed cleanup and service restart; confirm no orphan processes/containers and that unconfirmed cleanup blocks further jobs.
- Check UI at phone width, copy/download/history/screenshots, owner separation, and no frontend credential exposure.
- Measure memory/CPU/provider usage; verify spending controls and retention before opening access.

See `CHANGE_REPORT.md` for actual checks and blockers in this workspace.
