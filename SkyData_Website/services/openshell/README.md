# OpenShell integration gate — BLOCKED, NOT ACTIVATED

Run `python3 services/openshell/check_environment.py` to inventory the execution host without installing software, starting containers, calling model APIs or executing submitted code. A successful inventory is not security qualification. Existing `services/code-sandbox/` is preserved unchanged.

## Proposed boundary

Keep Nemotron generation, Knowledge Core retrieval and all NVIDIA/OpenAI credentials in SkyData's existing Worker. Send only an explicitly authorized code/test payload to an owner-authenticated HTTPS broker. The broker runs on a separate CPU host, uses OpenShell's supported SDK against a TLS-authenticated gateway and creates a fresh sandbox per job. No model provider is attached to execution sandboxes. No D1/R2/production secret or whole conversation is forwarded.

OpenShell 0.1.2 documents Python `SandboxClient` methods `create`, `wait_ready`, `exec`, `delete` and `wait_deleted`, scoped to a workspace. Use the matching gateway/SDK release. Do not invent a public OpenShell REST execution endpoint. The Worker-facing HTTPS broker is an application service to implement after qualification; it is not present now.

## Execution design to implement on an available host

1. Audit the supported runtime and active kernel qualification. Use a stable release. Pin gateway/runtime/workload images and record exact versions. Do not assume the existing gVisor configuration is OpenShell-compatible: its task-memory mediation and seccomp requirements need independent qualification.
2. Build a user-owned C++ OCI image with GCC or Clang, ASan/UBSan and known runtime libraries. Reuse old request validation, allowlisted presets and regression source fixtures; do not reuse the old in-container JSON harness as authoritative verification.
3. Set `landlock.compatibility: hard_requirement`; explicitly allow only required toolchain read paths and job workspace writes. Keep network policies empty, runtime resource limits enforced, provider attachments absent, bind mounts disabled and resource admission enabled. A policy draft is not an enforcement test.
4. Keep expected tests, job IDs, pass/fail decisions and immutable records outside the workload. Capture raw compiler/runtime outputs and exit status through the authenticated control plane. The broker computes stdout comparisons; never accept a workload's claimed `TESTS_PASSED`. Validate the sandbox/job identity on every result. Isolate stages and test proc/FD/ptrace tampering.
5. Apply global one-job concurrency, durable per-owner rate/budget reservations, max eight tests, bounded output and deadlines outside the workload. Cancellation must terminate the remote process/sandbox, not just cancel a browser connection. Every create/timeout/crash path requires deletion confirmation and stale-job cleanup.
6. Run the corrected C++ fixture (expected `20\n`) and the three independent sanitizer fixtures. Then test missing credentials, network/direct-socket bypass, host/private files, subprocess flooding, OOM attribution, timeout, output flood, parallel admission, result spoofing and cleanup after broker failure. Record real results before any activation.
7. Only after passing these gates add owner-only Run/Test controls, selected-model debugging capped at three attempts and owner-approved experience storage. Python/JavaScript follow their own qualification. Keep Decisions evidence tests unchanged and optional.

Official references:
- https://docs.nvidia.com/openshell/about/support-matrix
- https://docs.nvidia.com/openshell/sdk/python
- https://docs.nvidia.com/openshell/how-it-works/policies/schema
- https://docs.nvidia.com/openshell/security/best-practices
- https://docs.nvidia.com/openshell/how-it-works/gateways/authentication

No execution API, UI controls, broker secrets, paid infrastructure or verified-learning records have been enabled by this preparation.
