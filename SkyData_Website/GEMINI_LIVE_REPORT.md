# Gemini Live voice integration

## Implemented

Existing React/Vinext chat and Cloudflare Worker retained. NVIDIA text, Magpie speech, Knowledge Core retrieval, Decisions, documents, citations and model selection remain in place. Existing browser recognition/NVIDIA recorded speech remains available through the voice provider selector.

Google's official @google/genai 2.27.0 SDK connects the browser directly to Live using a short-lived, one-use backend-created token. Permanent GEMINI_API_KEY is stored using existing encrypted server-side storage or supplied through the Worker environment. Owner-only /connect-gemini verifies catalog access and requires confirmation of a billing-disabled project. /api/gemini-token checks authenticated owner access in the Worker, same-origin requests, existing rate limits and an atomic five-minute per-owner lease. No database migration or embedding regeneration.

Model: gemini-3.8-live, API v1beta. Default voice: Charon; selectable Puck, Kore, Fenrir. Native AUDIO output, input/output transcriptions, automatic voice activity detection, context compression and session resumption configured. No unsupported thinking or language-code options.

AudioWorklet captures a single microphone stream with requested echo cancellation/noise suppression/autogain. PCM is resampled to 16 kHz signed little-endian audio; incoming 24 kHz PCM streams through a bounded Web Audio queue. Server interruption flushes scheduled audio and resets avatar amplitude. The existing character consumes actual playback RMS. This is amplitude-driven mouth motion, not phoneme timing or semantic emotion recognition. Browser echo cancellation effectiveness depends on device/audio routing.

Mode A: Gemini handles live conversation. Mode B: Gemini can request the existing selected NVIDIA model via ask_nvidia for reasoning or uploaded-document questions. Limited to three calls per session. Existing /api/chat retrieves Knowledge Core normally. Gemini interprets tool results conversationally; it is not treated as verbatim TTS. NVIDIA citations are returned to Gemini as tool text; spoken restatement is not independently evidence-verified and current Live transcript persistence does not render structured source cards. No code execution tool is exposed.

Camera, when explicitly enabled, sends continuously sampled JPEG frames at at most one frame per second over the Live connection. Original camera preview and portrait are retained. Exit/backgrounding stops tracks, connections, queues and timers. Five-minute application safety cap, two reconnection attempts with resumption handle, quota/access failures stop instead of provider fallback. Session duration, connection/error status and provider-reported total tokens are displayed. No fabricated token estimates or dollar totals.

## Official documentation checked

- https://ai.google.dev/gemini-api/docs/live-api
- https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- https://ai.google.dev/gemini-api/docs/live-api/capabilities
- https://ai.google.dev/gemini-api/docs/live-api/session-management
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/speech-generation

The current documentation lists native-audio free-tier input/output for this model. Actual access and quotas are project-specific and must be checked in AI Studio. Free-tier data can be used for product improvement. Without compression, audio sessions are limited to 15 minutes and audio/video to two minutes; connection lifetime is approximately ten minutes, with supported resumption. Compression is configured, but the application deliberately caps sessions at five minutes.

Important: the Gemini key does not expose billing-tier verification. Owner confirmation is an attestation, not a technical pricing guarantee. To prevent billed use, use a project with billing disabled. SkyData does not enable Google billing, purchase services or silently fall back to paid models. Existing NVIDIA tool calls retain their existing provider usage/costs.

Paid reference rates if someone supplies a billed project: input text $0.75/M tokens, audio $3/M (approximately $0.005/min), image/video $1/M (approximately $0.002/min); output text $4.50/M and audio $12/M (approximately $0.018/min). No paid project is authorized by this implementation. Total-token messages do not provide sufficient modality attribution for exact cost measurement.

## Files

- lib/gemini-config.ts: model, voices, session config and NVIDIA tool contract
- lib/gemini-live.ts: encrypted connection setup and ephemeral token endpoint
- hooks/use-gemini-live.ts: session, streaming audio/video, interruption, resumption, transcripts, tool bridge
- lib/live-pcm.ts and public/gemini-mic-worklet.js: audio conversion/capture/playback
- app/page.tsx and components/reveal-avatar.tsx: targeted provider controls and existing avatar connection
- build/sites-worker.ts, lib/secret-store.ts, lib/request-limits.ts: existing authorization/configuration integration
- package.json, pnpm-lock.yaml, pnpm-workspace.yaml: SDK dependency; SDK/protobuf lifecycle scripts disabled
- scripts/test-gemini-live.mjs and scripts/test-gemini-token.mjs: regression checks

## Validation and limits

PCM conversion/resampling and malformed-input tests run against real functions. Audio ordering, interruption, bounded backlog and token provider are tested with mocks. Origin/authentication, free-tier gate, lease collision/release and provider quota failures are application tests with a mock database/provider; source guards are identified as source checks. Existing camera optimization, live-camera, voice startup, reveal-mode and avatar geometry regression scripts pass with their documented mocks.

No real Gemini API call, microphone conversation, iPhone Safari session, desktop audio session, network interruption or live NVIDIA tool call has been tested in this development environment. No user key was copied into source or tests. Setup model-catalog validation is not proof of successful Live access. End-to-end interruption latency, voice quality, acoustic echo cancellation and lip synchronization remain device tests. Browser support requires secure-context AudioWorklet/Web Audio/getUserMedia. A connection cannot be resumed without a server resumption handle; user restart is then required. Speech timing is not phoneme-exact. Retrieved tool content still requires evidence controls before treating spoken claims as verified.

## Activation and rollback

Open /connect-gemini as owner, use a billing-disabled project key, then choose Gemini Live and start microphone (or Reveal yourself). Browser microphone permission is required. Selecting NVIDIA returns to the original voice pipeline. Do not share the key in chat.

Rollback: select NVIDIA immediately, or redeploy the prior version backed by source commit b79afa944063fec9b253102a7f3372964fcdd8b4. No uploaded documents or database records are deleted by rollback. New encrypted key/attestation entries and temporary request-limit lease records can remain unused.

## Connection form compatibility fix

Gemini setup previously required an exact Origin while the other connection forms supported embedded WebKit's opaque origin with same-origin fetch metadata. Gemini now accepts only exact origin or Origin:null with Sec-Fetch-Site:same-origin; explicit cross-site metadata is rejected. Signed ten-minute user-bound CSRF remains required for key changes. Invalid origin and expired-token errors are distinct. The token endpoint uses the same origin check and retains owner authentication, rate limits and leases. Form action is explicit and key autocapitalization/spellcheck are disabled.

Regression tests exercise actual handlers with mocked HTTP headers and upstream responses: both exact and opaque same-origin forms reach Google validation; cross-site/unknown origins and invalid or other-user tokens do not. The opaque-origin token route passes. This reproduces the header compatibility issue in tests; actual iPhone headers have not been observed directly.
