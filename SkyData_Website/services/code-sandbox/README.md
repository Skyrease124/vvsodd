# SkyData C++ execution foundation — DISCONNECTED / NOT SECURITY-CERTIFIED

This directory is a separate-host prototype, not a Cloudflare Worker feature. It has **no HTTP endpoint**, imports no SkyData secrets, reads no D1/R2 data and is not connected to chat. Do not expose it or enable Run Code until the release gates below pass on the actual execution host.

## Components

- `Dockerfile`: C++/Python harness image (Python is infrastructure, not a supported user language).
- `runner.py`: host admission checks, strict C++ presets and limits, one concurrent job per process, unique disposable gVisor container, bounded IO, cancellation, 35-second outer deadline and mandatory removal. No shell interpolation, arbitrary compiler flags, package install, mounts, inherited container environment or host execution fallback.
- `inside.py`: trusted harness intended only inside the container; GCC compile output is separate from runtime output. Up to eight exact stdout test cases. Compilation deadline 10 seconds, each runtime 2 seconds, combined stream limit 32 KiB per stage. Stops at first failed test. `TESTS_PASSED` only describes the supplied tests, not universal correctness.
- `test_runner.py`: admission/control unit tests, with Docker inspection mocked where stated. No native user-code execution.
- `regression.py`: real C++/ASan regression suite. Refuses to start without prerequisite controls. Includes the exact buggy program plus separate probes for all three memory bugs, because a single run can stop at the first error.

## Security design and limitations

Required configuration: dedicated patched Linux host, Docker with audited `runsc` runtime, cgroup memory/PID/CPU support, seccomp enabled and an immutable locally present image digest. Each job requests `--network=none`, read-only image, unprivileged UID, all capabilities dropped, no-new-privileges, 64 PIDs, 512 MiB RAM/no extra swap, one CPU, no core files and a 64 MiB private work tmpfs. No host bind mounts or Docker socket enter a job. No GPU.

These options are requested, **not demonstrated in this environment**. Preflight is configuration checking, not proof. Root filesystem isolation permits the sandbox to read its own image files; it must not read host files. Docker controller access is highly privileged and belongs on a dedicated host, never on the app server. Cleanup failure is an error; an eventual service must latch admission closed and run a watchdog that removes stale labeled containers on restart/controller crash.

**Important outstanding verification boundary:** compiler/runtime/harness currently share a job namespace. A hostile native program could attempt to tamper with or spoof harness output. Do not use harness-reported results alone as proof for persistent verified memory. Before production, separate compilation and each runtime into independently controlled jobs, collect raw output/exit/OOM status through the host controller, and test harness tampering, `/proc` access, cross-job leakage, fork exhaustion and controller crash cleanup. Pin and audit the actual runtime binary, seccomp policy and image supply chain. This prototype is not an arbitrary-code security audit.

## Deployment sequence (no paid service provisioned)

1. Choose a dedicated execution host and approve its price before purchasing anything. No managed provider account or credential has been created.
2. Install Docker and gVisor following https://gvisor.dev/docs/user_guide/quick_start/docker/ . Verify the runtime path refers to the audited binary; guest `dmesg` is not security proof.
3. Build this image on that host: `docker build -t skydata-cpp:milestone services/code-sandbox`. Build-time package downloads are administrator-controlled; jobs never install packages. Scan it, push to your registry if desired, then use its real digest as `SKYDATA_SANDBOX_IMAGE=registry/image@sha256:<actual digest>`. Do not use a fabricated digest or mutable tag.
4. Run `python3 services/code-sandbox/runner.py --preflight`, then `python3 services/code-sandbox/regression.py`. Record compiler version, actual runsc version, image digest, OS and cgroups with reports. Fix sanitizer incompatibilities rather than bypassing gVisor or disabling constraints.
5. Complete the outstanding isolation tests and trusted-result boundary redesign above. An image build or passing stdout test does not prove security.
6. Only then add a private authenticated execution broker with TLS, a separate server-side broker credential, one global concurrent slot, durable per-owner quotas/budget reservations, request-size limits, idempotent jobs and cancellation. Do not put NVIDIA/OpenAI keys, databases, R2 credentials or private documents on the execution host. Broker credentials must never enter a job.
7. Connect an owner-only same-origin SkyData route using its existing `resolveAccess` / `isSiteAdmin` checks and DB rate limits. Explicit Run/Test/Auto-Fix actions only; no document/chat-triggered automatic execution. Cancellation must cancel the remote job, not merely stop the browser fetch.
8. Add selected NVIDIA model debugging with at most three correction attempts, retrieve existing Knowledge Core evidence, respect cancellation/security/budget failures and use real diagnostics. Keep Decisions optional and separate. Admit only host-confirmed tests into owner-reviewed experience memory. Add Python/JavaScript only after their real isolation regressions pass.

## Costs and credentials

Software here requires no API key or GPU and makes no AI calls. Actual new provider/API charges incurred: $0. Dedicated host, registry, storage and networking costs are not quoted because no provider or plan has been selected. Do not infer free hosting from free software. Capacity envelope: one job can reserve up to 35 seconds × 1 vCPU and 0.5 GiB RAM, approximately 0.00972 vCPU-hours and 0.00486 GiB-hours; multiply by your chosen host rates and include idle host costs. Auto-Fix would additionally use existing NVIDIA inference, up to the approved attempt cap. No cost is fabricated for a service not provisioned.

## Current execution example

On an approved isolated host only, pipe a JSON object to `runner.py`:

```json
{"language":"cpp","code":"#include <iostream>\nint main(){std::cout << 20 << '\\n';}","preset":"sanitizers","tests":[{"stdin":"","expectedStdout":"20\n"}]}
```

Language allowlist is currently C++ only. No packages or arbitrary flags. This command is intentionally not an app endpoint.
