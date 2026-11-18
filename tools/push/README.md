# Push notifications (OneSignal Web SDK v16)
- Service worker: `kinvest-liens/OneSignalSDKWorker.js` (site root, imports the v16 worker). Manifest: `manifest.webmanifest` (Home Screen install on iPhone and Android).
- Browser: `kinvest-liens/push.js`. Loaded on the account page and on devices that already turned notifications on. Asks for permission only after the member taps Enable. Automatic prompts from the OneSignal dashboard are turned off in code.
- Server: `netlify/functions/push.mjs` (settings, test), `push-run.mjs` (daily 15:00 UTC), `lib/onesignal.mjs` (delivery), `lib/pushjobs.mjs` (who gets what).
- Secret: Netlify environment variable `ONESIGNAL_REST_API_KEY` (App ID is public and defaults in code; override with `ONESIGNAL_APP_ID`).
- Tests: `node netlify/tests/push.test.mjs`, `node tools/push/browser.mjs` (needs the site served on localhost:8099).
- The OneSignal app only allows https://pricepocketasset.com, so a real subscription cannot be completed on a Netlify preview address.
