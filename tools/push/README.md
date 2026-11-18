# Push notifications (OneSignal Web SDK v16)
- Service worker: `kinvest-liens/OneSignalSDKWorker.js` (site root, imports the v16 worker). Manifest: `manifest.webmanifest` (Home Screen install on iPhone and Android).
- Browser: `kinvest-liens/push.js`. Loaded on the account page and on devices that already turned notifications on. Asks for permission only after the member taps Enable. Automatic prompts from the OneSignal dashboard are turned off in code.
- Server: `netlify/functions/push.mjs` (settings, test), `push-run.mjs` (daily 15:00 UTC), `lib/onesignal.mjs` (delivery), `lib/pushjobs.mjs` (who gets what).
- Secret: Netlify environment variable `ONESIGNAL_REST_API_KEY` (App ID is public and defaults in code; override with `ONESIGNAL_APP_ID`).
- Tests: `node netlify/tests/push.test.mjs`, `node tools/push/browser.mjs` (needs the site served on localhost:8099).
- The OneSignal app only allows https://pricepocketasset.com, so a real subscription cannot be completed on a Netlify preview address.

## Setup notes (learned during rollout)
- In OneSignal, Settings > Keys & IDs > Identity Verification: **Token Identity Verification must stay OFF**. OneSignal's documentation says Web SDK apps must not enable it (login fails and new devices cannot subscribe).
- The REST API key comes from the **App API Keys** section (one string, no spaces, new keys start with `os_v2_app_`). It is not the Identity Verification key pair.
- Netlify functions read `ONESIGNAL_REST_API_KEY` only after a new deploy.
- The first real delivery test must run on https://pricepocketasset.com (the OneSignal app allows only that origin).
- Key lookup order: the Netlify environment variable wins over the owner key box. If both exist and differ, the Netlify one is used (a wrong Netlify value caused a 401 during rollout). Keep one source only.
