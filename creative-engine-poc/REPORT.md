# SkyData Creative Engine: PhotoCraft in SkyData chat

**Status:** isolated prototype, working in desktop Chromium and an iPhone-sized Chromium emulation. **Not tested on a real iPhone or in Safari/WebKit.** Nothing in SkyData was changed, integrated or deployed.

Sources investigated:
- `storytold/photocraft` at `99e1138877e6aa7e856c6883b415e708d042fc59`
- `storytold/filmcraft` at `cee1feb185e675a108f78067f71ad86a640ace3d`

## 1. Summary

Feasible, without a PC, a server or a paid API. The prototype does the whole loop in the browser:

1. The user uploads a photo.
2. They type an edit in chat ("brighter and black and white").
3. The connector turns the message into an edit plan.
4. PhotoCraft's own engine runs the plan in a background thread (Web Worker), compiled to WebAssembly.
5. A preview appears in the chat bubble, with Undo and Download (JPG or PNG).

The photo never leaves the device.

Three findings shape everything else:

1. **PhotoCraft has no embeddable browser API.** Its web build (`apps/photocraft-web`) is the full desktop-style editor drawn on a canvas. So I wrote our own small bridge: about 160 lines of Rust over PhotoCraft's engine crates, with no UI and no GPU.
2. **PhotoCraft's MCP server only runs as a native program** (`photocraft-cli mcp`). Using it would need a PC or server, which you ruled out. The prototype uses the same command ids and parameters as MCP, so nothing is lost.
3. **It is alpha software, and it is single-threaded in the browser.** Edits on full 12 MP phone photos take seconds each, so chat edits run on a preview copy no larger than 1600 px. The download replays the same edits at full resolution, which took about 30 s for a 12 MP photo here.

## 2. Licensing

| Item | Licence | What it means for us |
|---|---|---|
| PhotoCraft, FilmCraft code | MIT OR Apache-2.0 (your choice) | We may use, modify and ship it, including commercially. Keep the copyright and licence notice (`THIRD_PARTY_NOTICES.md` is included). |
| "ArtCraft" name, wordmark, logos (`docs/brand/`) | Trademark, **not** covered by the licence | Do not use their logos or branding. Plain attribution ("uses PhotoCraft, MIT/Apache-2.0") is fine. The prototype shows no ArtCraft branding. |
| Bundled fonts, icons and images | Their own open licences (PhotoCraft `ATTRIBUTION.md`) | Before production, generate a full notice for every compiled-in crate and asset (for example with `cargo about`). |
| Rust crates the bridge pulls in | Various permissive licences | Same as the row above. |

PhotoCraft states that it is independent of Adobe. "Photoshop-compatible" is descriptive only, so avoid Adobe branding.

## 3. What was built (`creative-engine-poc/`)

| Path | What it is |
|---|---|
| `bridge/` | Rust crate `skydata-photocraft-bridge`, pinned to the exact PhotoCraft commit. It builds natively (for tests) and to WebAssembly. |
| `bridge/src/lib.rs` | Engine wrapper: open an image from bytes, run allow-listed commands, preview, export PNG/JPEG. |
| `bridge/src/native.rs` | Command-line test tool, using the same code. |
| `web/index.html`, `web/app.js` | The chat-style prototype page. |
| `web/engine-worker.js` | Runs the engine in a Web Worker. Handles proxy editing, full-size render, undo and rollback. |
| `web/planner.js` | The "AI command → edit plan" connector. |
| `web/pkg/` | The built WebAssembly and JS glue (in the ZIP, not in git). |
| `test/browser.test.cjs` | End-to-end Playwright test. |

### How it fits together
```
chat message ──► planner.js ──► edit plan [{command, params}] ──► engine-worker.js ──► PhotoCraft engine (WASM)
                 (rules now;                                      (Web Worker)          allow-list + param checks
                  SkyData's model                                   │                    run → preview / export
                  later)                                            └─► preview PNG / full-size JPG/PNG ──► chat bubble
```

### Safety built into the bridge (in Rust, so a bad plan can't get around it)

- **Exact allow-list.** 154 of PhotoCraft's 907 commands can run:
  - colour and tone adjustments;
  - filters;
  - rotate, flip, crop, resize and canvas size;
  - auto tone, contrast and colour;
  - select all/none/inverse;
  - undo/redo.
- **Refused by name:** anything whose name contains file, script, plugin, actions, automate, preset, prefs, batch, export, import, place, link, render, video, 3d, share or neural. Match Color and the LUT list are refused as well.
- **Refused parameters:** any parameter called file, path, url, source, sourceLayer, document, profile, lut or dir, at any depth. A command can't be pointed at a file or another document.
- **Limits:** input of at most 30 MB and 50 megapixels, and at most 24 steps per message.
- **No network access in the worker,** and no access to SkyData's code, cookies or APIs. The browser compiles PhotoCraft's own sandbox for plug-ins (wasmi), but the bridge never calls it, because plug-in commands are refused.

## 4. The connector: from chat text to an edit

`planner.js` produces the same output from two possible sources:

1. **`planWithRules()`: used now.** Free, offline and instant.
   - It understands about 35 common requests: brighter or darker, contrast, black and white, sepia, warmer or cooler, vibrant or muted, exposure, blur, motion blur, sharpen, denoise, grain, pixelate, oil paint, emboss, posterise, rotate, flip, aspect-ratio crops (square, 16:9, 9:16, 4:5), resize and auto-enhance.
   - It splits combined requests: "auto enhance, warmer and sharpen".
   - It explains when it can't do something: "remove the person" or "blur only the background" need AI features PhotoCraft doesn't have.
2. **`createModelPlanner(askModel, catalog)`: ready for later, not connected.**
   - It builds a system prompt from the engine's live allow-listed catalogue (ids, labels, parameter ranges) and expects JSON back.
   - It checks every command id, then the bridge checks everything again.
   - `askModel` would be SkyData's existing chat-model call, so there is no new paid service.

## 5. Test evidence

All numbers below were measured in this sandbox (a 4-core Linux container, headless Chromium from Playwright 1.56.1).

### End-to-end browser test: `test/browser.test.cjs`
Result: **26/26 checks pass** on two profiles, desktop (1280×860) and iPhone 13 emulation.

The iPhone 13 emulation uses the iPhone screen size, touch and Safari user-agent, **but the browser engine is still Chromium.**

| Check | Result |
|---|---|
| Engine loads in the worker | 154 commands, ready in about 0.35 s from a local server |
| Upload, preview | 1200×800 JPEG opens, preview shown |
| "make it brighter and black and white" | Colourfulness 146.8 → 0, i.e. truly grey |
| "square crop then rotate right" | 800×800 |
| Undo | Back to the previous state (1200×800, still grey) |
| "remove the person in the background" | Clear explanation; nothing runs |
| Download JPG | Valid JPEG |
| `file.save`, `file.scripts.run`, a `file` parameter and a nested `url` parameter sent **directly** to the engine | All refused |
| 12 MP (4032×3024) photo | Opens in about 1.6–1.7 s. "auto enhance, warmer and sharpen" (5 engine steps) takes about 4.5 s on the preview copy |
| 12 MP full-size download after "square crop" | 3024×3024 JPEG; full-size render and export took 28–31 s |
| JPEG with EXIF rotation (as iPhones save) | Comes in upright |
| Not an image | "Could not open this photo: The source image could not be decoded." |
| Page errors | None |

### Other measurements

**Preview vs final.** I compared the preview copy with the full-size download, scaled down, after these edits: vibrant, warmer, blur 3, sharpen, pixelate 10, 16:9 crop.
- Mean difference: 0.75 of 255.
- Mean colour: identical to 0.1.
- So what you see in chat is what you download.

**Speed of single commands on the full 12 MP image in the browser** (the reason for proxy editing):

| Command | Time |
|---|---|
| vibrance | 11 s |
| photo filter | 8 s |
| brightness/contrast | 7.5 s |
| Gaussian blur | 4 s |
| unsharp mask | 3 s |
| auto tone / auto colour | 1.5–2 s |
| rotate 90° | 2 s |

For comparison, natively vibrance takes about 0.8 s. A SIMD build of the WebAssembly made no difference, so it was not kept.

**Memory.** The engine's undo history was cut to one state: SkyData undoes by replaying edits instead.
- With the default 50-step history, a 12 MP full-size render peaked at **688 MB** of WebAssembly memory. That is too much for an iPhone tab.
- With one history state, the same render peaks at **394 MB** (re-measured after rebuilding; all 26 browser checks re-run and passing on that build).
- About 269 MB of that is already in use after opening the 12 MP photo, because the full image is decoded once to make the preview copy. Terminating the worker after each download would hand it back (section 9.3); the prototype doesn't do that yet.

**Download size.** The engine is 17 MB of WebAssembly, 7.0 MB gzipped. That is under the 25 MiB per-file limit of Cloudflare Pages/Workers.

**Native tests.** The same bridge, run as `bridge-native`:
- The plan "brightness/contrast, saturation −60, blur 3, rotate 90°, crop 600×900" gives 600×900 with the expected colour change.
- `file.save` is refused, and a `file` parameter is refused.

### Not tested, and why

**Real iPhone / Safari (WebKit):** this sandbox has only Chromium; there is no WebKit or Firefox, and I can't download them here. The prototype only uses features Safari has supported since iOS 15.4: module Web Workers, WebAssembly with bulk-memory and reference types, `structuredClone`, `createImageBitmap` and `ResizeObserver`. That is an expectation, not a test result. Before integrating, check on your iPhone:
1. The page loads; first load downloads about 7 MB.
2. A camera-roll photo opens. HEIC should be converted by Safari, or by the page's fallback.
3. An edit works.
4. Download opens the share sheet, and "Save Image" works.
5. A 12 MP full-size download finishes without the tab reloading.

**HEIC:** Chromium can't decode HEIC, so the fallback (browser decodes, then the engine opens it as PNG) was not exercised with a real HEIC file.

## 6. Limitations (honest list)

1. **Alpha engine.** PhotoCraft calls itself early alpha. Each command is wired, but not each behaviour is verified. I tested about 20 of the 154 allowed commands.
2. **No AI or generative edits.** That covers object removal, background removal or replacement, generative fill, and subject-aware blur. PhotoCraft lists AI as its biggest gap, and it has no subject masks in the browser. The prototype says so instead of faking it.
3. **Speed.** WebAssembly runs single-threaded (threads would need special cross-origin headers on the whole site and a nightly build). Previews are fast because they use the ≤1600 px copy. Full-size downloads of large photos take tens of seconds on a desktop, and iPhone speed is unknown.
4. **Memory on iPhone.** About 12 MP is the practical size today; 24/48 MP iPhone Pro photos are risky. HEIC photos that go through the browser fallback are reduced to 16 MP, Safari's canvas limit.
5. **The rule planner is simple and English-only.** Using SkyData's model (section 4) fixes this, at the cost of a model call per edit.
6. **The preview copy is 8-bit sRGB.** The full-size render starts from the original upload.
7. **The engine's own Undo is limited to one step.** Undo in the prototype is unlimited, because it replays edits.
8. **First load of 7 MB.** It is cached after that if the host sends long cache headers for a versioned path.

## 7. FilmCraft (video) later

The worker protocol is media-agnostic: `open`, `run`, `undo`, `export`, and `catalog` for the command list. A FilmCraft worker can implement the same messages, so the chat UI and the connector stay the same.

What FilmCraft's web build offers (from its `docs/web.md`; **not built or tested by me**):
- **Format:** a static site, WebGPU with a WebGL2 fallback, no FFmpeg. It decodes with the browser's hardware video decoder (WebCodecs) and exports H.264.
- **JS API:** `window.filmcraft.execute(command, params)`, `importFiles`, `readFile`. These belong to the full editor UI, however, not to a headless engine.
- **Single-threaded:** export renders frame by frame in about 30 ms slices on the main thread. Previews, proxies and mask tracking report errors on the web for now.
- **Memory:** media are read in chunks, with a 384 MiB cache; exported files are held in memory.

Two possible routes:
- **(a) Quick:** host FilmCraft web in a hidden, sandboxed iframe and drive it through `filmcraft.execute` via postMessage.
- **(b) Clean:** a headless FilmCraft bridge like the PhotoCraft one, with WebCodecs decoding brought across.

Either way, expect slow exports on a phone. Start with short clips (for example ≤ 30 s at 1080p) and simple edits: trim, speed, colour, text, crop. This is a separate project.

## 8. Safest way to add it to SkyData (proposal, needs your approval)

1. **Host it next to the site, not inside it.** Publish `web/` as static files under a new versioned path (for example `/creative/v1/`). It needs no server code, no keys, no database and no COOP/COEP headers, so nothing existing changes. Serve `.wasm` as `application/wasm`; it also works if the host doesn't.
2. **Lazy-load it.** Add one entry to the chat's attach menu ("Edit a photo") behind a feature flag (owner-only first). Only then load the worker, so other users and the existing chat download nothing.
3. **Keep it separate from Engineering Mode, Ray, models and workflows.** The editor talks only to its own worker. Its only link to the chat is "show this image and message" and "give me the user's text".
4. **Later, optional:** switch the connector to `createModelPlanner()` using SkyData's existing model call, with both the catalogue validation and the bridge checks kept.
5. **Before going live:** the real-iPhone checklist (section 5), a licence-notice file for all bundled code, and a size cap that matches what an iPhone actually handles.

## 9. Proposed architecture: Creative Files, chat previews and an on-demand full editor

**Your question:**
1. Can SkyData generate or edit images and videos and save them automatically to a separate Creative Files folder?
2. Can it show only a light preview in chat?
3. Can it let users open a saved file in the full editor, then save and return to chat, without keeping the heavy engine loaded?

**Short answer:** editing, saving, previews and lazy loading are possible. **Generating** images or video from a text prompt is not something PhotoCraft or FilmCraft can do. For the full editor, FilmCraft is close to ready; PhotoCraft needs a small change to its web shell (the page code that wraps the editor). Phone use of the full editors is the weakest part.

This section is investigation only, from the source and docs at the commits above. Nothing here was built or tested, apart from the memory figures, which come from the prototype.

### 9.1 What each part supports

| Need | PhotoCraft | FilmCraft |
|---|---|---|
| **Generate from a prompt** | **No.** No AI or generative features; its README calls this the biggest gap. It can make simple images from commands (new canvas, fills, gradients, shapes, text), so templates such as text cards are possible without AI. | **No.** Same: it edits and assembles media, it doesn't generate them. |
| **AI-driven edits** | **Yes.** This prototype. | **Possible, not built:** its own command system (650+ commands, used by its MCP server) is reachable from JS through `filmcraft.execute`. |
| **Full editor in the browser** | **Yes**, `photocraft-web`, a static site of about 23 MiB (10.5 MiB gzipped). It can be embedded in an iframe (documented), needs no COOP/COEP, and fits Cloudflare's 25 MiB per-file limit. | **Yes**, `filmcraft-web`, a static site. Bundle size isn't stated and I haven't built it. |
| **SkyData opens a saved file in the editor** | **Not yet.** Open goes only through the file picker or drag-and-drop. The web shell already has an internal "inbox" of (file name, bytes) that dropped files go through. A small change to our own copy (the licence allows it) could feed it from SkyData, for example with a `postMessage` listener. | **Yes:** `filmcraft.importFiles(files)`, `filmcraft.openProject(file)`. If the editor is served from the same site, SkyData's page can call these directly. |
| **Editor saves back to SkyData** | **Not yet.** Save and Export only download a file, and there is no web autosave. The same small change could send the bytes back to SkyData instead of, or as well as, downloading. | **Yes:** `filmcraft.files()` and `filmcraft.readFile(path)` return what it wrote; exports are kept in memory. |
| **Re-editable project format** | Yes: `.pcraft` (native, keeps layers), plus PSD, TIFF, ORA and others. | Yes: `.fcproj` project files. |
| **Crash recovery** | None on the web. | Yes: it auto-saves the project every 5 s to the browser's private file storage (OPFS) and restores it next visit. |
| **Phone use** | Desktop Photoshop-style interface on a canvas; no mobile layout or touch mode is mentioned. Usable on an iPad, cramped on an iPhone. | Desktop Premiere-style interface; same concern. |
| **HEIC (iPhone photos)** | Read-only, with the optional `heif` build feature. Official builds include it; this prototype's bridge doesn't yet. | Not documented. |

### 9.2 The recommended shape

```
 AI chat (light, always loaded)
 ├─ message bubbles show THUMBNAILS only (≈512 px JPEG, ≈50 KB)
 ├─ "Edit with AI" ──► quick-edit worker (this prototype, ~7 MB gzipped, started on demand,
 │                      terminated when idle) ──► saves result to Creative Files
 └─ Creative Files panel (list of items: thumbnail + metadata; originals stored separately)
       └─ "Open in editor" ──► full-screen editor page (PhotoCraft or FilmCraft web)
              loaded only now; on "Save & return" it hands the file back, then is removed
```

- **Creative Files** is its own store, separate from chat history. Each item has:
  - an id, name, kind (image/video/project), size and dates;
  - the original;
  - the latest version;
  - the editable project file (`.pcraft` / `.fcproj`) where there is one;
  - a small thumbnail.

  Chat messages hold only the item id and the thumbnail, so loading the chat never loads a full-size file.
- **Quick AI edits** use the lightweight bridge from this prototype, not the full editor. They are faster to load, need no GPU and use less memory.
- **"Open in editor"** loads the full editor only when the user asks. It gets the file from Creative Files. On save, the new version and a new thumbnail are written back, and the user returns to the chat.

### 9.3 Lazy loading and memory (the iPhone question)

Lazy loading works, with one rule that matters most on iPhone:

**WebAssembly memory never shrinks.** Once an engine has grown to, say, 270 MB, the only way to give that memory back is to end the thing that holds it: terminate the Web Worker, or remove the editor's iframe or page. Hiding it or closing a panel frees nothing.

Measured in this prototype: about 4 MB when loaded, about 270 MB after opening a 12 MP photo. The full-size render peaked at 688 MB with the engine's default undo history, and at 394 MB after reducing it to one state.

So:
1. **Nothing heavy at chat start-up.** Thumbnails only, and no engine.
2. **One engine at a time.**
   - Terminate the quick-edit worker after its download is done and after about 60 s idle. Restarting it costs well under a second once its file is cached.
   - Before opening the full editor, end the quick-edit worker.
   - On "Save & return", remove the full editor's iframe or page.
3. **Open the full editor full-screen**, either as a separate page or a full-screen iframe that is removed afterwards. Don't keep it hidden behind the chat. On iPhone, Safari reloads a tab that uses too much memory, so do a "save to Creative Files first" before any heavy step.
4. **Use size caps that match the phone.** Edit large photos on a reduced copy (as this prototype does). For video, start with short clips; FilmCraft's own read cache is 384 MiB.

### 9.4 Where Creative Files are stored

| Option | Good | Watch out |
|---|---|---|
| **On the device: IndexedDB** (or OPFS) | Free, private, no server change, works offline. IndexedDB is supported everywhere, including iPhone Safari. | Files exist only in that browser on that device. Safari can **delete a site's stored data after 7 days without a visit**, unless the user adds SkyData to the Home Screen as a web app, or the browser grants persistent storage (`navigator.storage.persist()`). Quotas vary by browser. Offer "Save to Photos / Files" for anything important. |
| **On SkyData's servers** (per account) | Follows the user across devices and survives clearing the browser. | Changes SkyData's backend and accounts, and needs file storage (cost, privacy, size limits). That conflicts with "don't introduce paid services" unless an existing free allowance covers it. **Needs your decision.** |

**Recommendation:** start on the device (IndexedDB) with a clear "stored on this device" label and an export button, then decide on cloud sync separately.

### 9.5 Generation: options to decide on

PhotoCraft and FilmCraft can't create content from a prompt. Possible routes:
1. Use an image-generation model SkyData **already pays for or can use free**. Its result would go into Creative Files like any other upload, then on to quick edits or the full editor.
2. Non-AI "generation" with PhotoCraft commands (backgrounds, gradients, text cards, collages) through the same allow-listed bridge.
3. No new paid API, as you asked. Option 1 depends on what your current model plan already includes, and I haven't checked that.

### 9.6 Suggested order (each step separate and testable, nothing touching current SkyData systems)

1. **Creative Files on the device:** store, thumbnails, list, delete, export. Connect it to this prototype's quick-edit result.
2. **Worker lifecycle:** terminate on idle and after export. Measure memory on a real iPhone.
3. **Full editor for video:** FilmCraft web, opened from Creative Files through its existing JS API, saving `.fcproj` plus the exported MP4. Test on iPad and iPhone.
4. **Full editor for photos:** a small change to our own copy of PhotoCraft web (open from SkyData, save back), saving `.pcraft` plus JPG/PNG. Keep the ArtCraft branding out.
5. **Later:** a generation source (section 9.5) and optional cloud sync (section 9.4), only after your decision.

**Honest risk:** the full editors are desktop-class interfaces. On an iPhone, the AI quick-edit path in chat will usually be the better experience, with the full editor as an option for iPad and desktop.

## 10. Reproduce

The build needs Rust with the `wasm32-unknown-unknown` target, `wasm-bindgen-cli` 0.2.129 and, optionally, binaryen `wasm-opt`.

```sh
cd creative-engine-poc/bridge
cargo build --release --target wasm32-unknown-unknown --lib
wasm-bindgen --target web --out-dir ../web/pkg target/wasm32-unknown-unknown/release/skydata_photocraft_bridge.wasm
wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-mutable-globals --enable-reference-types --enable-multivalue \
  ../web/pkg/skydata_photocraft_bridge_bg.wasm -o ../web/pkg/skydata_photocraft_bridge_bg.wasm   # optional, 28 → 17 MB
cd ../web && python3 -m http.server 8765        # open http://127.0.0.1:8765/
node ../test/browser.test.cjs http://127.0.0.1:8765/ <dir with test.jpg, iphone12mp.jpg, rotated6.jpg, notimage.jpg> <out dir>
```
