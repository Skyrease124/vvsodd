# SkyData Editor cutout tool: third-party files

These files run only in the visitor's browser; photos are never uploaded.

| File | Source | Licence |
|---|---|---|
| `vision_bundle.js` (published as `vision_bundle.mjs`), `wasm/vision_wasm_internal.*`, `wasm/vision_wasm_nosimd_internal.*` | Google MediaPipe Tasks Vision, npm `@mediapipe/tasks-vision@1.1.1` (source map reference removed) | Apache License 2.0 |
| `selfie_multiclass_256x256.tflite` | Google MediaPipe Selfie Multiclass Segmentation model, `storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/` (model card dated May 10, 2023) | Apache License 2.0 |

Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). Distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.

The model card lists human segmentation in images for interactive entertainment, AR and video calls as intended
uses; surveillance and identity recognition are out of scope. SkyData uses it only to separate a person from the
background for photo edits the user asks for.
