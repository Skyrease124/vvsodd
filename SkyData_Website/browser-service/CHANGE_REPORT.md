# SkyData Stagehand browser investigation — implementation candidate

Base: live version 112, commit `0923c9604b8cc76f256cced0f9f428f7b9dd0be6`.

**Not deployed. Not operational. Real isolated Stagehand execution remains unverified.** No hosting resources, subscriptions, provider accounts, live secrets or access-policy changes were created.

## Files changed

Modified:

- `app/engineering/page.tsx`: additive investigation source selector; the default remains ZIP. Website source is read-only and uses the existing engine/model selection.
- `app/engineering/engineering.css`: bounded width and overflow-safe styling for the new panel.
- `build/sites-worker.ts`: additive owner-gated browser API route.
- `lib/secret-store.ts`: optional backend runtime configuration type; no existing credential handling changed.

New:

- `app/engineering/website-panel.tsx`: URL/goal inputs, honest backend availability, event-based status polling, cancellation, saved report history, copy/download and screenshots.
- `lib/website-investigation.ts`: URL checks, owner/Origin gates, authenticated HTTPS backend calls with redirects refused, D1 job records, owner-scoped R2 reports/screenshots, final selected-model explanation and reuse of saved reports.
- `browser-service/{package.json,package-lock.json,.gitignore,url-policy.mjs,proxy.mjs,docker.mjs,worker.mjs,server.mjs,Dockerfile,Dockerfile.proxy,compose.yaml,test-real.mjs,README.md,CHANGE_REPORT.md,test/api.test.mjs,test/security.test.mjs}`.
- `scripts/test-website-investigation.mjs`, `scripts/test-website-unavailable.mjs`.

No existing ZIP/REA runner, Superpowers workflow, model-routing code, voice/Polly, Chill Mode, chat, auth, memberships, storage bindings or hosting configuration was modified. Engineering remains owner-only.

## Dependencies installed

Separate Node package only: Stagehand 4.2.1, playwright-core 1.58.2, ipaddr.js 2.2.0, zod 4.4.3. Lockfile has integrity entries; install scripts disabled. Root application dependency inputs unchanged. Chromium is specified in the Docker build; its image has not been built here.

## New capability implementation

Source choice is independent of engine choice. The intended job path is website -> authenticated self-hosted service -> disposable Chromium/Stagehand container -> captured public evidence -> optional real REA container -> existing selected report model -> owner-scoped saved report.

REA does not become an LLM label: it analyzes captured eligible JavaScript through the unchanged real adapter, in a separate network-none container. Superpowers receives browser observations alongside its unchanged research workflow. Both paths remain unavailable until separately verified.

No progress percentages are generated. Progress phases come from actual worker events; report generation occurs only after usable browser evidence is present. Cleanup failure blocks the service's browser slot. Cancellation is explicit, with no automatic browser-job retries.

Confirmed / likely / unknown classification is requested from the report model. Model output is interpretation; it is not automatically proven correct by this prompt. Backend observations carry page/network/interaction identifiers and limited source provenance. Reports do not claim private server architecture is observable.

## Actual checks performed

| Check | Execution type | Result |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | local | PASS |
| Site build | local, actual Worker/client bundles | PASS |
| Stagehand public API/custom-model schema contract | installed real 4.2.1 package, callback fixture | PASS |
| URL canonicalization and address classification | actual policy code | PASS |
| Mixed DNS results / pinned-address selection | DNS answers mocked | PASS |
| CONNECT loopback/metadata refusal | real local HTTP proxy/socket connections | PASS |
| New browser API integration | built Worker + Miniflare D1/R2; browser service and Gemini mocked | PASS: URL, owner, Origin, both engine contracts, evidence forwarding, invalid-result refusal, cancellation, persistence, report reuse and secret boundary |
| Unconfigured browser API | built Worker + Miniflare D1/R2 | PASS: unavailable status, start 503, zero outbound browser/inference requests |
| Existing 12 non-Docker engineering/runner/workspace/REA test scripts | local, mocked providers/Docker where labelled by each script | PASS |
| Existing model-selection test | built Worker, external inference mocked | PASS: four models, existing chat/coding/translation/streaming/Engineering and natural writing |
| Existing real Docker runner test | no Docker daemon/image | SKIPPED; nothing verified |
| Existing real REA test | no Docker/image | SKIPPED; nothing verified |
| Actual Stagehand browser launch attempt | installed package, requested local Chromium executable | BLOCKED: `/usr/bin/chromium` does not exist |
| Real backend integration script | no deployed backend/token/public fixture | BLOCKED; nothing verified |
| Client JS secret-identifier scan | 29 emitted client JS files | no backend token/URL or Gemini key identifiers found; not a substitute for runtime credential audit |
| ESLint on the two new application files | local | 0 errors; 2 warnings (plain screenshot img, unused destructured screenshot field) |
| Mobile/browser UI QA | browser-control capability unavailable | NOT RUN |
| Production backend, adversarial browser confinement, final live site flow | no compatible host configured | NOT RUN |

Existing non-Docker scripts: `test-engineering`, `test-engineering-integration`, `test-engineering-worker`, `test-runner-backend`, `test-runner-worker`, `test-project-runner`, `test-project-workspace`, `test-project-worker`, `test-proposal-diff`, `test-hp-runner`, `test-rea-job`, `test-rea-result`.

One real runtime issue found by the new tests: Cloudflare Worker fetch does not implement `redirect: "error"`. The connector now uses `manual` and explicitly refuses 3xx responses. This avoids forwarding its authentication token to a redirect target.

## Configuration, hosting and expenses

See README for commands, secret names, resource limits, source/host architecture, deployment verification checklist and known limits. Current Sites Workers cannot spawn Chromium. A separate dedicated Linux/Docker host and HTTPS endpoint are required. Your PC need not stay on after that backend is hosted.

Software requires no subscription. Hosting, bandwidth, storage and inference can incur recurring charges. Browser planning is capped at three provider calls, 2048 output tokens each, with reported browser token usage retained. Final reports reuse existing models and are requested up to 8192 tokens; existing handler does not expose final report token totals. No hosting provider or paid plan has been selected, so a bill cannot be quoted yet.

## Remaining work / limits

This candidate deliberately remains disabled. The real Chromium image, Docker networking/cleanup, Stagehand observe/act against real pages and real inference, hosted REA, cancellation/timeouts across all phases, mobile UI and security confinement must be verified on a compatible host before deployment/activation. Image/base/Chromium versions still need tested digest pinning. Native Chromium sandbox is disabled in the draft Docker setup; a hardened runtime and security review are required before hostile-site access.

Search submission, media playback, non-link button interactions, full accessibility/performance audits, live verified GitHub discovery, peak-memory telemetry, durable backend jobs and full report/evidence archive export are not implemented. Screenshot and report retention beyond the displayed last 50 records needs an explicit policy. HTTPS CONNECT is not decrypted by the proxy; request-policy coverage for service workers/new targets/non-HTTP protocols must pass real adversarial tests. These are material gaps, not verified capabilities.
