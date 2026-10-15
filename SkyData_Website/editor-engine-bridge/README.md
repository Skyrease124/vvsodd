# Editor engine bridge (build 2)

Source of `public/editor-engine/pkg` — PhotoCraft's engine (MIT OR Apache-2.0, pinned commit in `Cargo.toml`) behind
an allow-list of edit commands. Copied from `creative-engine-poc/bridge` (branch `claude/creative-engine-poc`) with
build 2's additions to `ALLOWED` in `src/lib.rs`:

- `select.subject`, `select.sky` and `select.modify.feather/expand/contract/smooth` (the Editor's `photo.area` step);
- the `filter.render.*` filters (clouds, lens flare, lighting effects, relight, picture frame, …).

Build (Rust with the `wasm32-unknown-unknown` target and `wasm-bindgen-cli` 0.2.129):

```sh
cargo build --release --target wasm32-unknown-unknown --lib
wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/skydata_photocraft_bridge.wasm
npx -p binaryen@123.0.0 wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-mutable-globals --enable-reference-types --enable-multivalue pkg/skydata_photocraft_bridge_bg.wasm -o ../public/editor-engine/pkg/skydata_photocraft_bridge_bg.wasm
cp pkg/skydata_photocraft_bridge.js ../public/editor-engine/pkg/
cargo run --release --bin bridge-native catalog   # the allowed commands, for lib/editor-catalog.ts
```
