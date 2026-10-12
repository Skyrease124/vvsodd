# SkyData Coding Intelligence 1.0 — first foundation milestone

**Outcome: foundation implemented; actual isolated execution blocked. Production execution remains disabled.** This does not satisfy a claim that SkyData can currently run or auto-fix programs. The request explicitly requires stopping before enabling execution if proper isolation cannot be supplied.

## Architecture inspected

- Existing React/Vinext application is deployed as a Cloudflare Worker using Sites. The current baseline is version 80, commit `6338a138f4051ff6606c011ea322fc8d8567f7cf` (Knowledge Core 1.3).
- `lib/nvidia.ts` routes the selected existing model to its provider. Knowledge retrieval runs alongside applicable live lookup. `lib/stream-reply.ts` streams ordinary replies and finalizes cited replies using source identity validation. Default/model settings remain untouched. Code mode currently says it has no execution tools.
- `lib/knowledge.ts`, `knowledge-ranking.ts` and `knowledge-citations.ts` use owner-scoped D1 records, existing NVIDIA embeddings, bounded semantic/lexical ranking and chunk-derived citation IDs. Originals are private R2 objects; PDF links navigate the physical file page. Nothing reindexed or removed.
- `lib/openai-decisions.ts` uses POST `/v1/decisions` on api.openai.com with `gpt-6-luna`; `lib/knowledge-decision-review.ts` exposes owner-triggered test-only fixed-choice evidence labels and private R2 reports. Compiler execution must remain separate from these AI assessments.
- `build/sites-worker.ts` resolves authenticated access before app routes. `lib/access.ts` supports native sign-in or hashed-token member sessions; owner checks use `nativeOwner`/`isSiteAdmin`. Origin checks and D1 request limits protect mutations. Existing limits include chat 40/min, knowledge 180/min and Decisions 6/min.
- Chat messages and source links are encrypted in D1 `chat_state` through AES-GCM server secret storage. Code blocks are Markdown message text, not executable jobs. The separate `/code` page currently keeps turns in React state and downloads replies; uploaded projects use existing project storage. There is no stored trusted execution result record.

## Isolation findings

The existing Worker cannot launch native GCC/Clang processes. Cloudflare Workers accepts JavaScript/WebAssembly rather than arbitrary native binaries (official security model: https://developers.cloudflare.com/workers/reference/security-model/). No isolated execution service or sandbox credential is configured in the inspected source. This development environment has no Docker, Podman or runsc command. The available bubblewrap probe failed with `Failed to create NETLINK_ROUTE socket: Operation not permitted`. No untrusted native code was executed on the host.

Selected design: dedicated execution host with Docker and gVisor `runsc`, separate from the production app. The gVisor configuration pattern is documented at https://gvisor.dev/docs/user_guide/quick_start/docker/. No infrastructure purchased or enabled.

## Files created

Only new files under `services/code-sandbox/`: Dockerfile, runner.py, inside.py, test_runner.py, regression.py and README.md; plus this report. Existing application code, frontend, provider prompts, models, auth, DB schema and deployment bindings were not modified.

## Status by capability

| Capability | Status |
|---|---|
| Architecture and execution-host boundary | Inspected and documented |
| C++ isolated-runner prototype and GCC presets | Implemented, not tested with real containers |
| Admission limits, immutable image requirement, fail-closed prerequisites | Six local control tests passed; some Docker metadata mocked |
| Time/output/concurrency/container cleanup code | Implemented; real enforcement untested |
| Original C++ memory-bug and correction fixtures | Implemented in regression suite |
| Actual C++/ASan execution | Blocked; zero real execution tests |
| Compiler/runtime versions tested | None; image has not been built |
| Container memory/PID/network/filesystem boundaries | Unverified; release gate remains closed |
| Owner HTTP execution API and Run/Test UI | Not implemented, intentionally stopped before exposure |
| NVIDIA bounded auto-fix | Not implemented pending trusted sandbox results |
| Python/JavaScript user execution | Not implemented; Python only implements the harness |
| Verified experience memory/dashboard metrics | Not implemented pending trusted execution |
| Decisions evidence tests | Preserved, not coupled to code execution |

## Regression result and diagnostic expectations

Six admission/control tests passed in the local environment. Python syntax checks and application TypeScript checks passed. The real regression command returned `BLOCKED` before any native execution because no immutable approved image is configured; command inventory additionally confirmed Docker/runsc unavailable. No sanitizers ran and no claim is made that the corrected program passed actual tests.

Static inspection of the supplied C++ code identifies three distinct defects: `i <= 5` writes index 5 outside a five-element array; `delete numbers` mismatches `new int[5]`; reading `numbers[2]` after deletion is use-after-free. The prepared correction uses `i < 5`, prints element 2 before deallocation and uses `delete[]`. Expected output is `20\n`, still unverified by real execution here. The real suite tests separate memory-error fixtures so one sanitizer failure does not conceal the others.

## Security limitations requiring work before activation

The current prototype harness shares a namespace with native code; result spoofing/tampering must be prevented through host-controlled isolated stage execution before storing verified experiences. Current configuration checking does not establish an audited binary or actual enforced limits. Real OOM/process exhaustion, cross-job leakage, control-plane auth/rate/budget limits and crash-recovery cleanup are not tested. A cleanup error returns failure but a future broker must also latch admission closed. No public endpoint exists, so this incomplete security work is not exposed through SkyData.

## Deployment requirements and operating costs

Provide a dedicated patched Linux execution host with audited Docker+gVisor, cgroups/seccomp and an approved immutable compiler image. Follow the step-by-step gate checklist in `services/code-sandbox/README.md`. After security testing, the app will need a private TLS broker URL and server-side broker credential; none is requested or inserted yet. Production/provider credentials must never enter the execution image.

Actual additional service/API spend: $0. No paid service was enabled. Host price remains unknown until a provider/plan is chosen and approved. Requested maximum resource reservation per run is 35 seconds, one vCPU, 512 MiB, one concurrent sandbox. No GPU needed. Decisions adds no execution cost because it is not called.

## Existing-feature impact and rollback

No existing app source file, database record, document, embedding, PDF link, chat layout, model default or connection was changed. Existing source contract/regression checks are rerun separately; mocks do not prove live NVIDIA availability or production mobile behavior. The public site remains version 80. Rollback for this foundation is to remove the newly added service/report files, or check out baseline commit `6338a138f4051ff6606c011ea322fc8d8567f7cf`; no database rollback required.
