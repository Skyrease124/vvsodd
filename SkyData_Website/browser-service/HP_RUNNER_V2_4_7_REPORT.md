# HP runner 2.4.7: captured scripts corrupted in transit (REA integrity failure)

Base: runner 2.4.6. **Not deployed. Linux Docker tested end to end; Windows HP verification of 2.4.7 is pending.**

## What the HP showed (runner 2.4.6, https://cinejoy.pk/, engine REA)
- `Website investigation: failed · REA capture analysis did not pass integrity checks.`
- The 2.4.6 timeout fix held: no timeout. The browser capture also finished.

## Diagnosis
- **Confirmed (source):**
  - `browser-job.mjs` read the browser container's output with `pending+=d`, which decodes each pipe chunk to text on its own.
  - A multi-byte UTF-8 character (Urdu text, emoji, other non-English text) split across two chunks became replacement characters. The captured script text then no longer matched the SHA-256 the worker computed inside the container.
  - The REA adapter correctly refused those files, and the runner reported its generic integrity message.
  - `rea-job.mjs` read REA's output the same way.
- **Reproduced, real Docker pipe:** a ~300 KB script with Urdu and emoji, parsed the 2.4.6 way, failed its SHA-256 check in 2 of 3 runs. A stream decoder passed 3 of 3. The result depends on where the chunks split, which is why it can vary between runs.
- **Reproduced end to end:** real Chrome in the test browser image loaded a fixture page that includes that script, then the real proxy, the real Docker pipe and the real REA container ran.
  - Runner 2.4.6: **3/3 failed** with `REA capture analysis did not pass integrity checks.`
  - Fixed runner: **3/3 complete**, with matching fingerprints and REA findings.
- **Ruled out (real REA):** HTML served as a `.js` script, empty scripts, JSON, ES-module syntax and JSONP-style bodies all gave partial findings with the workspace unchanged.
- **Likely, not proven:** cinejoy.pk's captured scripts contain non-ASCII text (this sandbox cannot load the site to confirm).

## Repair
- `browser-job.mjs`: one `StringDecoder('utf8')` per browser output stream. The byte limit still counts raw bytes. The integrity error now names the first failed check, e.g. `(REA status rejected: public/script-2.js does not match its approved SHA-256 fingerprint.)`.
- `rea-job.mjs`: the same stream decoding for REA adapter output (it affects ZIP REA output text too; no other behaviour changes).
- The browser worker, both Dockerfiles, the proxy and the REA adapter are byte-identical to 2.4.5, so no image rebuild is needed if 2.4.5's `Prepare_Browser.cmd` passed. Website code is unchanged except the download link.
- Not changed: the test-job output reader in `runner.mjs` has the same pattern, but it only affects how test output is displayed (nothing is checked against it), so it was left out of this focused fix.

## Verification
| Check | Kind | Result |
|---|---|---|
| `scripts/test-hp-browser-rea.mjs`: 7-byte chunks splitting Urdu/emoji keep script text intact, a REA mock that verifies SHA-256 like the adapter, named failed check, REA output split mid-character | Docker CLI, worker and REA **mocked** | PASS (the 2.4.6 runner code fails the same test, showing `سین��ا`) |
| `test-rea-job`, `test-rea-result`, `test-rea-real` (real REA 6.4.0 in Docker) | mocked / Miniflare / **real Docker** | PASS |
| `test-hp-browser`, `-diagnostics`, `-runner`, `-browser-worker`, `test-website-investigation`, `-unavailable`, browser-service unit tests | mocked / Miniflare | PASS |
| End-to-end capture and REA, as above | **real Linux Docker, real Chromium 155, real REA** | 2.4.6: 3/3 fail (HP message); 2.4.7: 3/3 complete; no containers left |
| Browser self-test from the extracted 2.4.7 ZIP | real Linux Docker | PASS (guard, 5 probes blocked, cleanup) |
| `tsc --noEmit`, `npm run build`, ESLint (0 errors) | local | PASS |
| ZIP integrity | local | 39 files identical to `runner-package/`; 11 mirrored files identical |
| Windows HP | real Windows HP | **NOT RUN, pending** |

The end-to-end runs used self-test mode, which skips the AI navigation step (it needs the website's model relay); capture, transport and REA are the same code as a live job.

## Install on the HP (pairing is kept)
1. Ctrl+C the runner window.
2. Extract `SkyData_HP_Runner_v2_4_7.zip` into a **new** folder.
3. No `Prepare_Browser.cmd` needed if it passed with 2.4.5 (images unchanged).
4. Run `Start_Runner.cmd`. Do not pair again.
5. Retry cinejoy.pk and type `yes`. If it still fails, the message now says which check failed; send a photo.
