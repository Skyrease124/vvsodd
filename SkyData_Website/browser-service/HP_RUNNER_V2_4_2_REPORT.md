# HP runner 2.4.2 — extension control connection

HP 2.4.1 evidence: Chrome reached DevTools listening, then failed with `CDP websocket failed to open`; cleanup confirmed. That exact error originates in Stagehand 4.2.1 extension/service-worker.js, whose browser WebSocket was incorrectly sent through our public-only proxy by `<-loopback>`.

The launch now keeps `<-loopback>` and adds only `ws://127.0.0.1:9222` as a bypass. HTTP loopback and other private endpoints remain proxied/blocked. Stagehand's wildcard `--remote-allow-origins=*` default is removed and replaced with the installed extension's exact origin, derived using Chromium's unpacked-extension ID algorithm (or manifest key). Before navigation, every job sends real upgrade requests to Chrome and requires HTTP 403 for HTTPS, HTTP, null and unrelated extension origins. Unexpected acceptance, timeout or errors stop the job. Self-test success also requires this check.

Validation: nine browser-service tests pass, including a real local HTTP handshake fixture checking rejection and acceptance failure; existing HP browser contract passes with Docker CLI mocked. Production site build passes. These tests do not run Chromium. Real Docker/Chrome/Windows verification remains pending; no live website investigation is claimed successful. No added dependencies or paid service, no ZIP/REA/voice/model changes.

Install: extract runner 2.4.2 in a new folder, keep Docker Desktop running and run Prepare_Browser.cmd; existing pairing retained. Rebuilt image invalidates the old image-bound self-test stamp.
