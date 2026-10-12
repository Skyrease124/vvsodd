# SkyData Superpowers Engineering Mode 1.0 — implementation report

Date: 2026-10-11 (America/New_York). Baseline source: `3f964848775844103c322cbb41e49e1001cda88d`, SkyData version 102. Work began on isolated branch `engineering-superpowers-v1`. Outcome: research and development-proposal integration implemented and tested with mocked external inference. Full autonomous engineering execution remains BLOCKED. Production deployment is not authorized by the original request and has not been performed.

## Implemented behavior

Added owner-only `/engineering` and `/api/engineering`, with a toggle, read-only Research default, Development proposal authorization for each task, existing three-model selector, saved-project selection, planning/debugging/review/test-design/performance workflows, request progress and error feedback, explicit test status, downloadable findings and manual source-versus-proposed-code comparison. Users can discard analysis or restore the previous analysis in the current page session; this does not restore project files. Run tests, Apply changes and Project rollback are visibly disabled.

The shared backend validates owner, same-origin JSON, strict request fields, available selected model, bounded streaming request body (180,000 bytes), at most 12 turns, 8,000 characters per user turn and 12,000 per assistant turn. Development requires `approved:true` and `action:propose`. Research is inspection only. Unknown fields/actions are rejected. Worker authorization and D1 rate limits (12 requests per owner per minute) precede the handler. No model output can trigger tools or mutations.

It selects and loads verbatim pinned upstream workflow text server-side, adds an explicit no-execution tool mapping, and calls the existing chat/knowledge/project pipeline. Returned server metadata always reports tests NOT_RUN, execution BLOCKED and modificationsApplied false. Task IDs and prompt-free lifecycle/status logs support operational inspection. They are platform logs, not a new durable audit database. Findings are model advice; mock responses do not prove live model adherence.

## Source inspection and actual models

| Available selector | Configured identifier | Existing effective text backend |
|---|---|---|
| Nemotron 3 Ultra | nvidia/nemotron-3-ultra-550b-a55b | Gemini adapter → gemini-3.8-flash |
| Nemotron 3.5 Lightning | nvidia/nemotron-3.5-lightning-30b-a3b | Gemini adapter → gemini-3.8-flash |
| GPT-OSS 20B | openai/gpt-oss-20b | Gemini adapter → gemini-3.8-flash |

Important pre-existing routing discrepancy: `build/sites-worker.ts` calls `handleChat` with `geminiUpstream(config)` and Gemini mode true. The adapter ignores NVIDIA selector identifiers for actual inference. This change preserves that behavior and visibly reports the actual Gemini model. All three selections reach the new orchestration, but three independent model inference paths are NOT integrated or verified. Restoring direct model-specific inference would require a separately scoped routing decision and real entitlement checks. No model was replaced by this work; no Claude requirement was added.

`lib/models.ts` contains legacy model settings (Nemotron thinking disabled, GPT-OSS low reasoning effort), but Gemini's effective adapter configuration does not use those model-specific reasoning settings. Coding quality and live reasoning capability have not been empirically tested here. Existing optional owner task routing remains unchanged and is deliberately disabled for this new endpoint to prevent selected-model fallback confusion.

Architecture: React 19/Vinext, Cloudflare Worker, D1 membership/limits/encrypted chat/knowledge records, R2 project files. The connected Netlify inventory did not contain SkyData; this selected SkyData is a Sites project. Existing authentication resolves approved members and native owner identity. Existing coding mode provides code advice and uploaded ZIP excerpts, not executable tools. Existing tool-adjacent features include Knowledge Core, project ingestion and separate Blender controls. Engineering Mode invokes none of Blender's mutation controls.

Voice configuration uses existing owner-managed Polly/Gemini settings and encrypted connections. No voice source, provider configuration, disabled state, environment variable, runtime secret or stored data has been changed. No game files were inspected or edited.

## Superpowers verification and compatibility

Authoritative source: https://github.com/obra/superpowers . Retrieved repository version 7.0.0, commit `bb92a77741419a4ab5f06e711a283343f1ada0c3`. Read README, MIT license, installation instructions, new-harness porting guidance, reference adapter and selected skills. Vendor provenance and full MIT attribution are retained.

Superpowers supplies composable skill text plus harness-specific bootstrap/tool mapping; it is not a hosted execution service. Its new-harness guide requires automatic bootstrap, actual file read/write and shell capabilities for a full harness port. SkyData lacks those execution capabilities. This implementation is a compatible workflow adaptation, NOT an official supported harness integration or a complete Superpowers port.

Working application plumbing: automatic selected-skill injection on each Engineering request, planning/debugging/review/test-design/performance instruction selection, existing code-evidence retrieval and actual backend attribution. Not implemented: model-directed skill discovery tool, shell, native tool calling, autonomous test/fix loop, independent reviewer/subagents, git worktrees for end-user projects, benchmark measurements, applied patches, project rollback or deployment. No unsupported tool is advertised as callable. Test design is available; test execution is not.

No new npm/runtime dependency was added. Only selected MIT skill bodies were vendored and compiled into a server-only module. Installation hooks and upstream visual companion are not run. No telemetry or external logo requests were added. Skill references not provided in context are explicitly unavailable.

REA was investigated separately using its official README; it is not installed. Future integration is a separate evidence-producing analysis worker as described in `docs/engineering/EXECUTION_SERVICE_DESIGN.md`.

## Verification evidence

| Check | Result and limits |
|---|---|
| `node scripts/test-engineering.mjs` | PASS: validation, origin/owner denial, three selections, approval, unsupported execution rejection, truthful status; chat generation mocked |
| `node scripts/test-engineering-integration.mjs` | PASS: real handler → existing chat → Gemini SDK request → response; real SQLite owner guard; external inference mocked |
| `node scripts/test-engineering-worker.mjs` | PASS: compiled Worker in Miniflare, D1 membership/owner/rate limits, origin, actual SDK dispatch and execution rejection; external inference mocked |
| TypeScript `tsc --noEmit` | PASS after correcting new-page response types |
| Site build | PASS, includes `/engineering`; existing Vinext route-classification warning remains |
| Existing AI routing and dashboard suites | PASS with mocked inference and real SQLite migrations |
| Existing Gemini provider suite | PASS with mocked text/voice; no real provider call |
| Existing Polly suite | PASS: owner controls, voice/cache/limits and disabled Gemini zero-request cases; text selections preserved; AWS/text mocked |
| Existing compiled Polly Worker check | Initially failed because regex disallowed `$` in valid minified JS identifiers. Updated test matcher only; rerun PASS in the built Worker with mocked AWS rejection |
| Existing Knowledge suite | PASS: real migrations, uploads/retrieval/citations/exclusions/deletion; NVIDIA/R2 mocked |
| Existing sandbox admission suite | 6 PASS; configuration mocks are not runtime isolation proof |
| OpenShell environment inventory | BLOCKED, exit 2: runtime/gateway/container tools absent, KVM inaccessible; no authenticated remote service supplied |
| iPhone, landscape, desktop browser QA | NOT RUN. Responsive CSS supplied; no supported browser-QA capability available in this managed task |
| Live inference from three independent models | NOT RUN / incompatible with preserved effective routing |
| Live voice, production regression, project rollback | NOT RUN; no production changes or project mutations |

No user-uploaded program has been compiled or executed. No live-provider health, autonomous debugging success, browser compatibility or secure isolation claim is made.

## Execution design and costs

A separate qualified HTTPS execution broker and isolated compute service are required for arbitrary builds/test workloads. Full requirements, operation allowlist, proposed limits, network/filesystem separation, image pinning, independent result verification, audit/cancellation/cleanup and rollback gates are in `docs/engineering/EXECUTION_SERVICE_DESIGN.md`. That service is designed, not provisioned or activated.

No new paid service or billing setting has been enabled. Existing inference limits/pricing still apply, and additional skill context increases token usage. No fixed hosting quote is invented. New runner account, secrets, dependency images and any billing require explicit authorization and qualification.

## Changed files and rollback

Modified: `app/page.tsx`, `app/code/page.tsx` (links only); `build/sites-worker.ts` (owner route); `lib/request-limits.ts` (new route limit); `scripts/test-polly-worker.mjs` (valid JS-identifier matcher).

Created: `app/engineering/page.tsx`, `app/engineering/engineering.css`, `lib/engineering.ts`, `lib/engineering-contract.ts`, `lib/engineering-skills.ts`, three `scripts/test-engineering*.mjs` suites, this report, execution-service design and `vendor/superpowers/` (seven verbatim skill files, MIT license, provenance).

Existing runtime dependencies, models, chat logic, voice modules, auth implementation, deployment manifest, environment variables, secrets and databases are unchanged. Rollback of this feature is reverting this change or restoring the baseline source/saved version; no schema migration is needed. End-user project rollback remains unavailable because no projects are mutated.

## Release status and remaining work

Research/proposal foundation is implemented; full requested 1.0 capability is incomplete. Save for review without deploying. Remaining: secure runner provisioning and real isolation tests; tool protocol and revision-bound approvals; durable task/audit state; real tests/debug loops and change application/rollback; selected-model routing decision and live model tests; independent review; mobile/desktop QA and production verification. Production publication remains gated on explicit user approval for the concrete reviewed version.
