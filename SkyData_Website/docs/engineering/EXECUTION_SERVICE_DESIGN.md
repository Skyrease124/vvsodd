# SkyData Engineering execution service — gated design

Status: DESIGN ONLY. No service deployed, account opened, environment variable changed or command execution exposed. The research/proposal endpoint deliberately has no execute action.

## Boundary and control flow

SkyData runs a Cloudflare Worker, not a Netlify Function in this selected project. Preserve its existing inference, authentication, D1 and R2 bindings. Arbitrary builds and uploaded programs must execute outside the Worker, on a dedicated qualified host or managed sandbox. The existing OpenShell evaluation remains a candidate, not a connected service.

Owner submits explicit Run/Test action for an immutable, reviewed project revision → Worker rechecks membership, owner, same-origin request, durable budget/concurrency reservation → authenticated HTTPS broker creates isolated workspace → administrator-pinned tools execute allowed build/test operations → independent verifier collects diagnostics → results include immutable revision, tool/image versions, exit status and logs → broker destroys workspace and confirms cleanup.

No shell strings are accepted from a model or public client. Prefer structured operations (compile_cpp, test_python, test_javascript) mapped by the broker to fixed executable argv arrays. Reject unknown operations, flags, absolute paths, traversal, symlink escapes and unqualified dependencies. A model may recommend a command in text; that text is never executed automatically.

## Required qualification before activation

- Dedicated Linux host supporting chosen isolation runtime; OpenShell hard filesystem enforcement, seccomp/Landlock and runtime-specific cgroup controls must actually pass. Runtime presence alone is not evidence.
- Authenticated TLS broker with audience-scoped service credential. Never place NVIDIA, Gemini, AWS, R2, production DB or personal credentials in jobs. Provisioning a new secret requires explicit approval.
- One global concurrent job initially. Per-owner durable job, runtime and spending quotas; reject when reservation fails. A minimum limit of one cannot be multiplied by running additional broker instances.
- Initial policy candidate: 1 CPU, 512 MiB RAM, 32 processes, 100 MiB temporary storage, 30-second job deadline, 256 KiB diagnostic output. These are proposed values, not measured controls; validate actual enforcement before selecting them for production.
- Deny all network by default. No host mounts, privileged containers, Docker socket, production checkout or shared writable dependency caches. Dependency resolution is administrator-controlled image construction, with lockfile, provenance, vulnerability scan and digest pinning; never install packages from a submitted job.
- Per-job disposable filesystem and user identity. Never trust workload JSON to decide PASS. Capture OS exit codes, independent test expectations and verified diagnostics outside the submitted program.
- Idempotency keys and revision hashes bind approval and test results to exact bytes. Changing code or dependencies invalidates approval and verified status. Token expires after one job and cannot authorize deployment.
- Cancellation reaches the broker, kills the whole process group and confirms deletion. Cleanup failure closes admission, alerts owner and invokes a stale-workspace watchdog. Client disconnect alone is not proof of cancellation.
- Append-only, metadata-only audit events for authorization, reservation, lifecycle, exit status, image digest and cleanup; protected diagnostic artifacts with bounded retention. Do not log credentials or source by default.
- Real tests: process/memory/disk exhaustion, timeout, network denial, host filesystem/proc/FD access, cross-job leakage, secret access, result spoofing, compiler/sanitizer defects, crash cleanup, duplicate submission, cancellation and stale approvals.

## Development isolation and rollback

Build/test only an immutable copy of a reviewed revision. Preserve original ZIP and git branch. Changes are proposed patches bound to base revision, visible in file-level diff, then separately authorized for an isolated branch. No production mutation or deployment permission is implied. Rollback restores a known revision with its dependency lock and migrations; reversibility must be tested on the project before enabling the control.

## REA

Official REA repository: https://github.com/morluto/rea . Its README describes an MCP/terminal toolset whose analyses run locally, including JavaScript and native binaries with optional native analysis engines. No REA dependency is installed here. A future separate authorized analysis worker can produce bounded evidence reports consumed by the engineering orchestrator. REA gets its own operation allowlist, artifacts and isolation qualification; its tool output remains untrusted evidence, never permissions or commands.

## Cost and activation

No new hosting cost has been incurred. Use an existing qualified host only after uptime, isolation and maintenance assessment; alternatively obtain a managed sandbox quote. CPU compute, storage, transfer and existing inference usage may be billed. Additional skill context increases inference token usage; no fixed free allowance or total cost is asserted.

Activation requires an identified host or managed service, authenticated broker provisioning, actual qualification results and explicit approval for new secrets/billing. Until then return BLOCKED, never fabricated compile/test output.
