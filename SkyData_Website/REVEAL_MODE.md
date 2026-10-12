# SkyData reveal mode

Send the standalone phrase `Reveal yourself` to open a full-screen metallic male avatar. 650 canvas particles assemble smoothly; the vector face fades into the assembled head. Eyes glance and blink; the mouth follows RMS levels measured from decoded NVIDIA reply audio. This is volume-driven mouth animation, not phoneme/viseme synchronization or an animated version of the supplied photo.

The overlay hides the existing chat and composer without deleting conversation state. Exit (or Escape) ends recognition, aborts pending work, stops playback and returns to chat. The existing NVIDIA voice endpoint receives `Leo` for reveal replies; normal conversation retains `Aria`. First-use microphone permission and browser playback policies remain in effect. No new provider, credential or database changes.

Validated: TypeScript, production build, reveal-command matching, mocked audio RMS, male/default voice selection, playback completion/stop cleanup, existing reply reveal tests, four conversation request contracts and five model contracts. No live NVIDIA voice request, browser QA or iPhone performance measurement performed in this task. Camera is not required for face voice mode. Actual microphone/recognition and voice availability must be checked on the user's device.

Files: app/page.tsx, hooks/use-voice-conversation.ts, components/reveal-avatar.tsx, components/reveal-avatar.css, lib/reveal-command.ts, scripts/test-reveal-mode.mjs.

Rollback: restore/deploy saved version 84, or revert the reveal-mode source commit and rebuild. Existing models, Decisions, Knowledge Core and stored records were not modified.
