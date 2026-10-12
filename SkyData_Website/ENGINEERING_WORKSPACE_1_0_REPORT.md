# Engineering Workspace 1.0 + HP Runner v2.2 — change report

Base: published version 106 (commit 8f6bb32…) from the handoff ZIP. **Not deployed.** Hosting, auth, owner checks, models, voice, storage bindings and secrets configuration are unchanged.

## Source inventory findings
- Handoff ZIP passes `unzip -t`; no truncated source found (baseline `npm run build` and `tsc --noEmit` both succeed).
- There is no `app/api/` folder; this is expected: every `/api/*` route is served by `build/sites-worker.ts`.
- `drizzle/meta` has snapshots only up to 0011 although the journal lists 14 migrations (0012, 0013 lack snapshots). Pre-existing; `npm run db:generate` may produce a confused diff. No new migrations were added: new tables are created at runtime with `CREATE TABLE IF NOT EXISTS`, the same pattern the existing runner tables use.
- The v106 build already references a non-emitted `/_next/static/chunks/engineering-*.js` (one 404 in the console on /engineering). Pre-existing framework artifact; unchanged.
- `npm run lint` had 100 errors before any change; files touched here went from 12 to 8 errors (all remaining are pre-existing lines). New files are lint-clean.

## Stage 1 — Project file browser (works without the HP)
- `GET /api/projects/:id/files` lists every ZIP entry with an honest label: text source, non-text asset, over 2 MB, encrypted/unsupported compression, unsafe path, duplicate path. Case-only collisions are reported.
- `GET /api/projects/:id/file?path=` reads the **complete** file from the stored original ZIP with R2 range reads and verifies CRC-32 (not the upload index, which truncates and skips non-code files). Shows SHA-256 and line count.
- `GET /api/projects/:id/search?q=` searches the upload index and says that it is partial; filename search covers every entry.
- Explicit AI selection: tick up to 20 files; `ProjectAttachment.paths` sends exactly those files, read in full (120,000-character shared budget). Each is labelled FULL / TRUNCATED / UNAVAILABLE to the model, and the Engineering response reports exactly what the model received with SHA-256 fingerprints. Without a selection, the previous excerpt behaviour is unchanged.
- Ownership: all routes sit under the existing `/api/projects` handler (membership gate, `owner = ?` row match, Origin check on writes, 240/min limit).

## Stage 2 — Original vs proposed comparison
- Proposals are stored separately (`projects/<id>/proposals/<pid>.json`); originals are never modified.
- A replacement for an existing file is accepted only with the SHA-256 of the complete original it was written against (the model must have received it FULL, or you opened it in the browser). Truncated, binary, oversized, duplicate and unseen files are refused. New files (for example tests) are labelled as new.
- AI output is parsed only from fences marked ```` ```lang file=<path> ````; snippets are never treated as files.
- Line diff (Myers) with changes-only and whole-file views. Approve / Reject / Undo per file, bound to the reviewed text's SHA-256; conditional R2 writes prevent lost updates.

## Stage 3 — Corrected ZIP
- `POST …/proposals/:pid/package` builds a **new** archive: unchanged entries are copied byte-for-byte (compressed data included), approved files are replaced or added, and the archive comment is kept. Pending and rejected files keep the original.
- Refuses ZIP64, split archives, unsafe paths, ambiguous duplicate targets, encrypted targets, overlapping entries, more than 65,534 entries or more than 500 MB. Uses R2 multipart (fixed 8 MiB parts). After building, it re-reads the new ZIP and checks every approved file's SHA-256; on mismatch the output is discarded. Nothing is executed. The original upload stays as it is. Keeps the 3 latest builds per proposal.
- Not tested at the 500 MB limit inside the hosted Worker (CPU and time limits of the hosting plan are unknown); tested to >20 MB locally.

## Stage 4 — Test history and runner status
- New `engineering_runner_history` (last 50) stores run ID, kind, project/proposal, entry, per-file SHA-256 and source, payload SHA-256, status, live phase, result and diagnostics. Source text is not kept.
- Status separates: waiting for the HP to collect → waiting for “yes” on the HP → docker_check → container_start → executing → cleanup → final result, or expired.
- The website states that polling only proves the runner process is connected. v2.2 reports when Docker was last verified; older runners are labelled as not reporting it.

## Stage 5 — Approved proposal → HP test
- `/api/engineering-runner/proposal-preview` shows the exact files, sources, fingerprints and a static import check (npm packages are unavailable on the runner; unselected relative imports are listed). `/proposal-test` requires `approved:true`, at least one **approved** proposal file and no unapproved proposal file. The HP still shows every file and requires a typed “yes”. No automatic execution and no retries.

## HP runner v2.2 (`runner-package/`, `public/SkyData_HP_Runner_v2_2.zip`)
Diagnosis from the code (not yet confirmed on the HP): v2/v2.1 start the 10-second timer when `docker run` is spawned, so Docker start-up counts as code time. On timeout they kill only the docker CLI. A cleanup `docker rm -f` that is slow (15 s limit in v2, 30 s in v2.1) **overwrites** the result with `infrastructure_error` and discards “timeout”. `spawnSync docker ETIMEDOUT` in Self_Test means `docker info` took longer than 15 s (v2). Simulated on real Docker with an artificially slow docker CLI: v2.1 reports `timeout` for a trivial snippet when start-up takes 11 s, and `infrastructure_error` + “Container cleanup could not be confirmed” when `rm` also takes 35 s (the observed symptom). v2.2 passes both and shows the slow phase.

v2.2 changes: `docker create` + `docker start -a -i`. A preload writes a random start marker, and the **10-second limit is measured from code start**; container start-up has a separate 60 s cap and runs no code. A Docker check (90 s) runs after the local “yes”. On timeout it uses `docker kill`. Cleanup is confirmed with `docker container inspect`. Per-phase timings carry the exact command and error code, and the code's own result is kept when cleanup fails. Self_Test writes `selftest-report.txt` (no tokens). Isolation flags are identical to v2.1. Backward compatible with the current live site.

## Evidence (what was and was not verified)
| Check | Kind | Result |
|---|---|---|
| Existing 7 engineering/runner tests | local, built Worker + Miniflare D1/R2, mocks as before | PASS |
| `test-project-workspace.mjs` | real ZIPs (Python zipfile, data descriptors), SQLite, in-memory R2 stand-in; output checked by Python zipfile and `unzip -t` | PASS |
| `test-project-worker.mjs` | built Worker + Miniflare D1/R2, real upload API; Gemini mocked; HP simulated | PASS |
| `test-proposal-diff.mjs` | 400 randomized diffs, block parser | PASS |
| `test-hp-runner.mjs` | runner contract, docker CLI mocked | PASS |
| `test-runner-docker.mjs` | **real Docker 29.8.2 on a Linux machine**: uid 1000, read-only root, noexec /tmp, CapEff 0, no-new-privileges, 256 MB, 64 pids, loopback only, no DNS, no host secrets, 10 s limit, forged markers, output limit, no leftover containers | PASS |
| v2.2 Self_Test | real Docker, Linux | PASS (4/4) |
| Browser end-to-end (Playwright, built Worker under local Wrangler, identity headers injected) | local | upload → browse → search → view → select → proposal → diff → approve → corrected ZIP → proposal test preview; no horizontal scroll at 390 px |
| HP (Windows 11, Docker Desktop, WSL2) | live | **NOT RUN — unverified** |
| Live website | — | **NOT DEPLOYED** |
