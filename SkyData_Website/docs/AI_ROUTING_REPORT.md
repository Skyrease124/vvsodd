# SkyData provider routing — implementation and release report

Date: 2026-10-11. Existing source baseline: a2f2128c8b1a664a0a816d7ac11b34ddf92a853f.

## What is implemented

An independent TypeScript routing module, owner model-management page at `/owner/models`, and explicit Task routing controls in normal text chat and Code mode. Existing model choices and default behavior remain intact. New routing starts disabled; no provider credentials, spending settings, or existing encrypted secrets were changed.

- Fixed server-side registry for NVIDIA NIM and OpenRouter. Provider URLs cannot be supplied by a browser. Credentials are read only from `NVIDIA_API_KEY` and `OPENROUTER_API_KEY` runtime environment variables.
- Authenticated catalog discovery and timestamped health results; catalog success is explicitly distinct from successful generation. Catalogs expire for routing after one hour and must be refreshed. Provider failures are shown as sanitized status codes, never raw error bodies.
- Separate routes for chat, coding, research, and translation. Coding and chat controls are available in the UI; research follows the chat search/research flags. Translation routing is supported by the server request contract, but the existing interpreter UI remains on its original path.
- Up to three ordered models per task. NVIDIA is listed first. Fallback requires owner opt-in and only proceeds after transport failures, 429, or selected 5xx responses. Auth and request errors stop. Responses are buffered before delivery, so a partially displayed answer is never restarted on another provider. This adds first-response latency compared with true token streaming.
- Cost gates: NVIDIA hosted use requires prototype confirmation. OpenRouter requires a catalog-listed `:free` variant with explicit zero prompt/completion/request prices, plus zero-price request constraints. Paid and unknown-price routes are blocked. No subscription-login or account-rotation mechanisms were imported.
- Atomic daily attempt cap, including failed attempts; request rate limits; bounded provider response sizes; cancellation and timeouts. No automatic paid fallback.
- Usage records: provider/model/task/status/latency and provider-reported token counts. Unknown token counts remain unknown. No prompts, answers, or keys are stored in this telemetry. Dashboard aggregates the UTC day; records older than 30 days are removed when catalogs are refreshed. Legacy API usage is not included.
- Owner authorization, same-origin/CSRF form protection, restrictive dashboard CSP, escaped output, and no-store responses.
- Additive D1 migration and schema declarations. Chat history, uploaded projects, search, voice configuration, Polly runtime fix, and legacy model integrations remain on their existing paths.

## Activation status and how to try

The connected site's runtime environment inventory does not list NVIDIA or OpenRouter API-key variables. Existing keys may instead be in the app's encrypted D1 secret store. The dashboard reports names of those legacy connections without revealing their values. Those legacy connections were not deleted or moved.

1. Configure `NVIDIA_API_KEY` as a secret runtime environment variable for the existing SkyData site. Optionally configure `OPENROUTER_API_KEY` the same way. Do not put either in browser code, public build variables, chat messages, or Git.
2. Open Owner dashboard → AI models & routing → Refresh catalogs & health.
3. Select primary models for the task categories. For NVIDIA, confirm permitted prototype use after checking the model terms. Optional fallback sends the conversation to each selected provider attempted.
4. Enable owner routing and save. In chat or Code mode, check Task routing. The reported model identifies the actual routed provider. Uncheck Task routing to use the existing behavior immediately.

Live provider generation has NOT been verified with these runtime keys. No paid inference calls were made during testing. Missing runtime keys are an activation blocker, not evidence that the existing encrypted keys are invalid.

## Reference repository review

Reference: https://github.com/alishahryar1/free-claude-code
Reviewed commit: fa6adde24f1dae9b3e9d265435c1de43b2711075.

The repository declares AGPL-3.0-only. Its Python/FastAPI architecture includes a provider catalog, provider adapters, model routing/fallback, local admin UI, harness integrations, and local persistence. README claims 61 providers; the catalog includes NVIDIA NIM, OpenRouter, Groq, OpenAI API, Anthropic, Gemini, DeepSeek, and local-model integrations. Claims of aggregate free tokens are not guaranteed allowances for this SkyData account.

Security review found loopback client/Host/Origin checks for local administration and optional constant-time proxy token verification. Settings default to binding `0.0.0.0`, with proxy authentication disabled and a default token value. These defaults are not an appropriate public multi-user application security boundary. We did not run its installation scripts or embed its daemon. No repository implementation code or assets were copied; its high-level provider/adapter/routing concepts were used as architectural reference.

## Netlify suitability

The reference repository is not a drop-in Netlify serverless application: it expects a persistent Python runtime, local state, and local development harnesses. SkyData itself is currently a Sites application using a Cloudflare Worker, D1, R2, and its existing membership system. The connected Netlify account was inspected, but the identified SkyData source/deployment was the existing Sites app. Its hosting was preserved after the user confirmed this is the app to modify.

The fetch-based router design is portable, but its D1 persistence and SkyData authorization integration require explicit Netlify adapters and migration work. No Netlify deployment, Netlify production certification, or hosting migration is claimed.

## Provider terms and API findings

- NVIDIA: OpenAI-style chat completions at `https://integrate.api.nvidia.com/v1/chat/completions`; bearer authentication. Hosted developer endpoints are documented for prototyping, with production entitlement a separate matter. The dashboard does not assert production eligibility or invent a fixed free quota. See https://docs.api.nvidia.com/nim/reference/llm-apis and https://docs.api.nvidia.com/nim/docs/product .
- OpenRouter: authenticated model catalog, pricing metadata and OpenAI-style chat endpoint. Only verified zero-price free variants are eligible here. Account limits, availability, model terms and data practices still apply. See https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties , https://openrouter.ai/docs/guides/routing/model-variants/free and https://openrouter.ai/terms .
- Existing Gemini, direct DeepSeek, OpenAI, voice, search and specialty integrations are preserved but are not automatic fallback targets. Additional adapters need individual cost, API, and terms review.

## Verification and limitations

New routing tests pass for discovery, pricing/prototype gates, fallback behavior, daily-cap reservation, error sanitization, buffered SSE, cancellation, catalog expiry, environment-only keys and telemetry redaction. Dashboard/integration tests apply the full real SQLite migration chain and test rendering, CSP, CSRF/Origin rejection, saved settings, non-owner denial and an actual request through the existing chat handler to a mocked routed provider.

TypeScript checking passes after adding explicit parameter types to the existing Vite Polly resolver. Production build passes. The real compiled Polly Worker bundle test passes against a mocked AWS response.

Existing regression results were compared against a clean checkout of the original commit: 14 passed in both; four failed identically in both; two require absent original C++.pdf fixtures. No new failure appeared in the runnable suite. Existing failures:

| Test | Existing failure |
|---|---|
| camera-dialogue | Source-string assertion for old camera scale expression |
| gemini-live | Source-string assertion assumes voice-preview is first in an owner-only route list |
| knowledge-model-contracts | Expects direct DeepSeek models to be available although already disabled |
| reveal-mode | Expects the older Leo voice field |

Blocked: knowledge-decisions and knowledge-evidence fixture tests. Existing passes cover avatar behavior, Blender pairing, camera optimization/live camera, conversation style, Gemini provider/token behavior, knowledge storage/citations/streaming, Polly conversation/provider behavior, reply performance and voice startup.

Browser/mobile device QA, real microphone/camera playback, live account quotas and live inference were not performed. Consequently this is a guarded owner-preview release, not a claim that every existing feature or provider works end-to-end. Routing is off by default and does not affect existing requests without the explicit routing flag. A browser test and permitted live request are still needed after runtime configuration.

## Remaining concerns / unsupported capabilities

No free Anthropic Claude entitlement is supplied. No autonomous terminal agent, local harness, computer control, model training, custom provider URLs, subscription OAuth bridge, paid-model fallback, distributed circuit breaker, automatic quota refresh, or full streaming failover is implemented. Task routing uses explicit task flags, not a paid classifier.

Model-specific terms must be checked for the selected use; discovery is not legal or production approval. Fallback sends the request context to each attempted provider. Dollar costs and quota remaining are unknown and are not fabricated. The provider-only usage cap does not change pre-existing search/voice billing or limits.

The original default chat adapter routes through Gemini while the legacy selector uses NVIDIA model names. That pre-existing behavior is preserved; new routed responses report their actual provider/model. Existing telemetry and UI outside the new router are not retroactively relabeled.
