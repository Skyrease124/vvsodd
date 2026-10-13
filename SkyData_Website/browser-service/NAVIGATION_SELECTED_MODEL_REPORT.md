# Website: browser navigation uses the selected model

**Not deployed (publish through ChatGPT Sites). No HP runner change.**

## Change
- `lib/hp-browser.ts` (`/api/engineering-runner/browser-model`, the relay Stagehand calls through the HP's egress proxy):
  - Looks up the model saved with the investigation (`engineering_browser_jobs.model`).
  - **Gemini selected:** unchanged native structured-output path.
  - **Any other model** (e.g. Nemotron 3 Ultra): the request goes through `handleChat`, the same provider path as chat and reports, with the same keys, availability checks and no paid fallback. The JSON Schema and the bounded Stagehand conversation go in the system prompt, marked as untrusted website data.
  - The reply must be one JSON value (a code fence is tolerated) that passes a bounded structural check against Stagehand's schema (type, required, properties, items, enum).
  - Otherwise the relay answers 502 with a fixed reason, e.g. `Browser navigation model failed (Nemotron 3 Ultra returned no valid JSON). No paid fallback.` A 429 is passed on as 429. Provider text and keys are never forwarded.
  - The three-call budget, relay token, phase gating and size limits are unchanged.
- `lib/website-investigation.ts`: for HP investigations, the report's `usage.browserModel` records the selected model, since the runner labels it with a fixed name.
- `app/engineering/website-panel.tsx`: the text now reads "Browser navigation and the report both use your model selection above."

## Verification
| Check | Kind | Result |
|---|---|---|
| `test-hp-browser-worker`: Nemotron selected, so NVIDIA is called with the schema, untrusted marker and Stagehand prompt; fenced JSON accepted; prose, wrong-format JSON and provider error give named 502s; no Gemini call; report records the selected model. Gemini path and 429 unchanged | built Worker + Miniflare, NVIDIA and Gemini **mocked** | PASS |
| `test-website-investigation`, `-unavailable`, `test-rea-result`, `test-engineering*`, `test-model-selection`, `test-polly-worker`, HP runner suites | mocked / Miniflare | PASS |
| `tsc`, build, ESLint (0 errors) | local | PASS |
| Real Nemotron 3 Ultra answering Stagehand's navigation prompt | live | **NOT RUN**: no NVIDIA access from this sandbox |

## Known risks
- Large models can be slower than Gemini Flash. The HP egress proxy and worker allow 45 s per navigation call. A slower answer counts as a relay failure: runner 2.4.9 then keeps the evidence and finishes, while 2.4.8 fails the investigation.
- A model that does not follow the JSON instruction gets a named relay error, handled the same way.
