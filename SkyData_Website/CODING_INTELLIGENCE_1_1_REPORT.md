# SkyData Coding Intelligence 1.1 — OpenShell suitability and release gate

Date: 2026-10-09. Outcome: **OpenShell is a suitable architectural candidate; real execution is BLOCKED.** The requested first secure C++ milestone cannot be claimed completed. Per the request, implementation stops before execution/API/chat activation when isolation infrastructure is unavailable.

## Official findings

NVIDIA's documentation currently identifies stable OpenShell 0.1.2. The repository is Apache-2.0 licensed. It is a sandbox runtime, not an included free hosted compiler service. It runs tools installed in operator-owned OCI images, so GCC/Clang, Python and Node can be packaged as workloads; actual language/sanitizer compatibility still requires testing. CPU-only operation is appropriate for compilation and external model calls; GPU allocation is optional. Sources: https://docs.nvidia.com/openshell/home and https://github.com/NVIDIA/OpenShell .

Supported compute choices include Docker, Podman, Kubernetes and MicroVM. Current prerequisites specify Docker 28+, Podman 5.x or Kubernetes 1.29+, while MicroVM needs host virtualization. Linux sandbox qualification requires Landlock ABI 3+, appropriate seccomp user-notification operations and broker-to-workload task-memory access. Kernel version alone is insufficient. Windows WSL2 is experimental; an existing PC is only a candidate, not an already qualified host. Source: https://docs.nvidia.com/openshell/about/support-matrix .

The Python SDK (Python 3.11+) documents authenticated gateway access and explicit-workspace lifecycle/exec methods: create, wait_ready, exec, delete, wait_deleted. SDK installation does not install the CLI. Non-loopback access requires TLS; service automation can use OIDC client credentials. This supports a separate broker; direct compatibility of the SDK transport with Cloudflare Workers is not assumed. Sources: https://docs.nvidia.com/openshell/sdk/python and https://docs.nvidia.com/openshell/how-it-works/gateways/authentication .

Security controls include network policy, Landlock filesystem confinement, seccomp/privilege dropping and provider credential mediation. Missing network rules deny egress. Crucially, filesystem `best_effort` may continue without requested filesystem rules; select `hard_requirement`. Formal policy checks do not prove programs correct or replace runtime isolation tests. Sources: https://docs.nvidia.com/openshell/security/best-practices and https://docs.nvidia.com/openshell/how-it-works/policies/schema .

MicroVM provides a VM boundary; Docker/Podman provide their respective container boundaries. Kubernetes additionally requires a CNI that actually enforces NetworkPolicy. Bind mounts can expose host data and require dangerous relaxed admission settings; do not use them here. CPU/memory sizing is runtime-dependent; process limits and output/deadline controls need configured enforcement and measurement. Source: https://docs.nvidia.com/openshell/how-it-works/sandboxes/runtimes .

## Existing SkyData inspected and preservation

Current repository baseline: `9722f3d4683fdd2bc0c271a5de5afc097583f659`, saved foundation version 81. Public site remains Knowledge Core 1.3 version 80. React/Vinext, Worker, D1 DB, R2 FILES, owner authentication and rate limits are unchanged. NVIDIA's selected-model generation/streaming path, Knowledge Core ranking and stable PDF citations, encrypted chat storage and Decisions (`POST https://api.openai.com/v1/decisions`, `gpt-6-luna`) remain intact.

Read all six existing sandbox files. Reusable components: request/code/test limits, compiler flag presets, corrected/original C++ fixtures, separate memory-bug cases and regression expectations. Not reusable as security proof: old Docker/runsc preflight, mocked restriction tests, or a workload's own JSON success claim. The old harness shares a namespace with native code; preserve it as a disconnected prototype, not verified-result authority. No old prototype file was removed or modified.

Nemotron compatibility is achieved by keeping inference in the current Worker and transporting authorized code/diagnostics only. No model replacement, provider rerouting or credential attachment inside execution jobs is needed. This is a design conclusion, not a tested end-to-end integration.

## Changes and tests

Created `services/openshell/check_environment.py`, `services/openshell/README.md` and this report. No existing production source, dependency, configuration, DB table or record changed. The inventory script is implemented and tested with a real read-only environment check; it starts no workload and makes no network calls.

Inventory returned BLOCKED: Linux kernel 6.18.44; openshell, openshell-gateway, Docker, Podman, kubectl and Helm absent; /dev/kvm inaccessible. No authenticated remote gateway configuration is available to this session. The kernel number does not certify Landlock/seccomp support.

The existing six admission/control tests passed again. Docker inspection is mocked in relevant unit tests; these are not real isolation results. Actual OpenShell sandboxes created/deleted: 0. Native C++ compilation/execution tests: 0. ASan/UBSan tests: 0. Security runtime tests: 0. AI calls: 0. No fabricated output or sanitizer diagnosis is reported.

| Capability | Status |
|---|---|
| Official suitability research and prototype inspection | COMPLETED |
| Read-only environment inventory and integration gate checklist | IMPLEMENTED / TESTED WITH REAL INVENTORY |
| Existing prototype admission/control tests | TESTED WITH MOCKS / 6 PASSED |
| OpenShell gateway, sandbox creation and compiler execution | BLOCKED |
| Python/JavaScript execution | NOT IMPLEMENTED |
| Owner execution API and chat controls | NOT IMPLEMENTED / activation deferred |
| Three-attempt debugging and verified experience storage | NOT IMPLEMENTED / awaiting trusted execution |
| Existing models, Decisions, Knowledge Core and data | PRESERVED; no live-provider health claim |

## Cost-conscious options

| Option | Monthly cost | Complexity / reliability | Isolation and integration limits |
|---|---|---|---|
| Existing compatible CPU computer + OpenShell | $0 new hosting fee; electricity/internet remain | Moderate/high setup; depends on uptime | Best first free-hosting candidate; qualify kernel/runtime. On Windows WSL2 is experimental. No access to the user's PC is available here. |
| GitHub Codespaces for development | $0 within personal Free allowance: 120 core-hours and 15 GB-month; overages metered | Easy dev access; unsuitable as an assumed always-on service | OpenShell nested runtime/kernel compatibility unverified; included compute is not proof of isolation. Disable paid overages. |
| Dedicated CPU VPS + OpenShell | Paid host quote required | More operator work; can offer persistent broker | Choose supported Linux; MicroVM needs offered KVM/nested virtualization. Check actual limits. Hetzner's retrieved page did not expose usable numeric pricing, so no invented quote. |
| E2B managed sandbox alternative | Hobby $0 base with $100 one-time credit, then usage costs | Lower infrastructure work; provider-managed API | Separate alternative, not an OpenShell host by assumption. C++ image and required restrictions need qualification. No account/key configured. |

GitHub source: https://docs.github.com/en/billing/concepts/product-billing/github-codespaces . E2B source: https://e2b.dev/pricing . VPS source: https://www.hetzner.com/cloud/cost-optimized/ .

E2B publishes default 2 vCPU + 4 GiB usage at $0.000046/second, about $0.1656/runtime-hour. Illustrative 1,000 jobs at 30 seconds each: $1.38 compute before other charges; that is arithmetic, not measured SkyData billing. Hobby credit is one-time, not permanent free compute. Pro is $150/month plus usage and is not required or activated. No new service or billing was enabled; actual new service/API spend is $0. For OpenShell, quote host, storage, images/registry, traffic and idle uptime before approval. No GPU purchase is needed for this proposed workload.

## Deployment requirements, remaining gates and rollback

Next requirement is access to an existing compatible CPU host or an authenticated available OpenShell gateway. No purchase is necessary merely to prepare code; do not enable billing without approval. Match SDK/gateway stable releases; pin and qualify image/runtime. Configure hard filesystem enforcement, no provider attachments or private mounts, deny-by-default network, CPU/memory/process quotas and independent broker deadlines/output limits.

The separate HTTPS broker must preserve owner authorization, origin validation, global concurrency, durable rate/cost controls, cancellation and cleanup. Keep expected answers and pass/fail computation outside submitted code; test spoofed result output, proc/FD tampering, cross-job leakage and crash cleanup. Then run the corrected C++ program and three defects independently in actual isolation. Only after the entire gate passes add chat execution and learning. Details are in services/openshell/README.md.

Rollback: remove the three new preparation files or restore baseline commit above. No DB rollback, reindex, secret rotation or public-site rollback is required. Production was not activated or changed.
