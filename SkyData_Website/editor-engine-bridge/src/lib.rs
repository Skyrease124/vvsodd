//! SkyData Creative Engine POC: a thin bridge over PhotoCraft's headless engine (MIT OR Apache-2.0).
//! The same code runs natively (tests) and as WebAssembly in the browser. It only loads an image from bytes,
//! runs allow-listed engine commands and exports PNG/JPEG bytes: no files, network, scripts or plug-ins.
use photocraft_engine::{Session, command_specs};
use photocraft_io::ExportOptions;
use serde_json::{Value, json};

/// Inputs above these are refused before decoding, so a phone browser tab is not exhausted.
pub const MAX_INPUT_BYTES: usize = 30 * 1024 * 1024;
pub const MAX_PIXELS: u64 = 50_000_000;
/// At most this many commands per AI turn.
pub const MAX_STEPS: usize = 24;
const HISTORY_STATES: u32 = 1;

/// Commands an AI turn may run: colour and tone adjustments, filters and whole-image transforms (exact ids or `x.` prefixes).
/// Everything that touches files, scripts, actions, plug-ins, preferences, other documents or the UI is excluded.
const ALLOWED: &[&str] = &["image.adjustments.", "image.imageRotation.", "image.rotation.arbitrary", "image.crop", "image.imageSize", "image.canvasSize", "image.trim", "image.autoTone", "image.autoContrast", "image.autoColor", "image.mode.grayscale", "image.mode.rgb", "filter.", "edit.undo", "edit.redo", "select.all", "select.deselect", "select.inverse",
    // Smart selections (classical, on-device), so an edit can be limited to the subject or the sky, and their refinements.
    "select.subject", "select.sky", "select.modify.feather", "select.modify.expand", "select.modify.contract", "select.modify.smooth"];
const DENIED: &[&str] = &["image.adjustments.matchColor", "image.adjustments.colorLookup.list"];
const BLOCKED_PARTS: &[&str] = &["file", "script", "plugin", "actions", "automate", "preset", "pref", "batch", "droplet", "export", "import", "place", "link", "render", "video", "3d", "share", "neural"];
/// Parameter keys that would name a file, path, URL or another document: refused in any step.
const BLOCKED_PARAMS: &[&str] = &["file", "path", "url", "source", "sourceLayer", "document", "profile", "lut", "dir"];

pub fn allowed(id: &str) -> bool {
    let matches = |p: &&str| if p.ends_with('.') { id.starts_with(p) } else { id == *p };
    let lower = id.to_ascii_lowercase();
    // Render filters (clouds, lens flare, lighting effects, relight, …) only draw into the image; "render" stays blocked elsewhere.
    let parts: Vec<&str> = lower.split('.').collect();
    let blocked = parts.iter().enumerate().any(|(i, part)| BLOCKED_PARTS.iter().any(|b| part.starts_with(b) && !(i == 1 && *b == "render" && parts[0] == "filter")));
    ALLOWED.iter().any(matches) && !DENIED.contains(&id) && !blocked
}

fn params_ok(params: &Value) -> Result<(), String> {
    match params {
        Value::Object(map) => {
            for (k, v) in map {
                if BLOCKED_PARAMS.iter().any(|b| k.eq_ignore_ascii_case(b)) {
                    return Err(format!("parameter `{k}` is not allowed"));
                }
                params_ok(v)?;
            }
            Ok(())
        }
        Value::Array(items) => items.iter().try_for_each(params_ok),
        _ => Ok(()),
    }
}

/// The commands the AI may use, as `[{id,label,menu,params}]` (`all` lists the whole registry, for investigation only).
pub fn catalog(all: bool) -> String {
    let rows: Vec<Value> = command_specs().iter().filter(|c| all || allowed(c.id)).map(|c| json!({"id": c.id, "label": c.label, "menu": c.menu, "params": c.params})).collect();
    serde_json::to_string(&rows).unwrap_or_else(|_| "[]".into())
}

pub struct Editor {
    session: Session,
}

impl Editor {
    /// Decode an uploaded image (PNG, JPEG, WebP, PSD, … as PhotoCraft's importer supports) and make it the document.
    pub fn open(name: &str, bytes: &[u8]) -> Result<Editor, String> {
        if bytes.len() > MAX_INPUT_BYTES {
            return Err(format!("The file is {} MB; the limit is {} MB.", bytes.len() / 1_048_576, MAX_INPUT_BYTES / 1_048_576));
        }
        let imported = photocraft_io::import(name, bytes).map_err(|e| format!("Could not open the image: {e}"))?;
        let size = imported.document.size;
        if u64::from(size.width) * u64::from(size.height) > MAX_PIXELS {
            return Err(format!("The image is {}×{} pixels; the limit is {} megapixels.", size.width, size.height, MAX_PIXELS / 1_000_000));
        }
        let mut session = Session::new();
        // Undo is done by replaying edit plans from the original, so the engine keeps one history state,
        // not its default 50 (each one can hold a full copy of the pixels).
        session.edit_prefs(|p| p.performance.history_states = HISTORY_STATES);
        session.add_document(imported.document, None);
        Ok(Editor { session })
    }

    pub fn info(&self) -> String {
        match self.session.active() {
            Some(st) => json!({"width": st.doc.size.width, "height": st.doc.size.height, "layers": st.doc.layer_count()}).to_string(),
            None => json!({"error": "no document"}).to_string(),
        }
    }

    /// Run `[{"command": id, "params": {...}}, ...]` in order. Each step is checked against the allow-list first;
    /// the first failure stops the list and is reported with the steps that already ran.
    pub fn run(&mut self, steps_json: &str) -> Result<String, String> {
        let steps: Value = serde_json::from_str(steps_json).map_err(|e| format!("Edit plan is not JSON: {e}"))?;
        let steps = steps.as_array().ok_or("Edit plan must be a list of steps.")?;
        if steps.len() > MAX_STEPS {
            return Err(format!("At most {MAX_STEPS} edit steps per request."));
        }
        let mut done = Vec::new();
        for step in steps {
            let id = step.get("command").and_then(Value::as_str).ok_or("Each step needs a \"command\".")?;
            if !allowed(id) {
                return Err(json!({"error": format!("`{id}` is not an allowed edit command."), "done": done}).to_string());
            }
            let params = step.get("params").cloned().unwrap_or_else(|| json!({}));
            if let Err(e) = params_ok(&params) {
                return Err(json!({"error": format!("`{id}`: {e}"), "done": done}).to_string());
            }
            match self.session.execute(id, params) {
                Ok(result) => done.push(json!({"command": id, "result": result})),
                Err(e) => return Err(json!({"error": format!("`{id}` failed: {e}"), "done": done}).to_string()),
            }
        }
        Ok(json!({"done": done}).to_string())
    }

    /// Flattened result as `png` or `jpg` bytes (`quality` 1..=100 for JPEG).
    pub fn export(&self, format: &str, quality: u8) -> Result<Vec<u8>, String> {
        let st = self.session.active().ok_or("no document")?;
        let ext = match format.to_ascii_lowercase().as_str() {
            "jpg" | "jpeg" => "jpg",
            "png" => "png",
            other => return Err(format!("Unsupported export format `{other}`; use png or jpg.")),
        };
        let mut opts = ExportOptions::default();
        opts.encode.jpeg_quality = quality.clamp(1, 100);
        photocraft_io::export(&st.doc, ext, &opts).map(|r| r.bytes).map_err(|e| format!("Export failed: {e}"))
    }

    /// A PNG preview scaled to fit `max_side` pixels, for the chat bubble.
    pub fn preview(&self, max_side: u32) -> Result<Vec<u8>, String> {
        let st = self.session.active().ok_or("no document")?;
        let img = photocraft_compose::thumbnail(&st.doc, max_side.max(16));
        let image = photocraft_codecs::Image::from_u8(img.width, img.height, photocraft_codecs::ChannelLayout::Rgba, img.pixels).map_err(|e| e.to_string())?;
        photocraft_codecs::encode(&image, photocraft_codecs::Format::Png, &Default::default()).map_err(|e| e.to_string())
    }
}

#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen(js_name = commandCatalog)]
    pub fn command_catalog() -> String {
        super::catalog(false)
    }

    #[wasm_bindgen]
    pub struct PhotoEditor(super::Editor);

    #[wasm_bindgen]
    impl PhotoEditor {
        #[wasm_bindgen(constructor)]
        pub fn new(name: &str, bytes: &[u8]) -> Result<PhotoEditor, JsError> {
            super::Editor::open(name, bytes).map(PhotoEditor).map_err(|e| JsError::new(&e))
        }
        pub fn info(&self) -> String {
            self.0.info()
        }
        pub fn run(&mut self, steps_json: &str) -> Result<String, JsError> {
            self.0.run(steps_json).map_err(|e| JsError::new(&e))
        }
        #[wasm_bindgen(js_name = exportImage)]
        pub fn export_image(&self, format: &str, quality: u8) -> Result<Vec<u8>, JsError> {
            self.0.export(format, quality).map_err(|e| JsError::new(&e))
        }
        pub fn preview(&self, max_side: u32) -> Result<Vec<u8>, JsError> {
            self.0.preview(max_side).map_err(|e| JsError::new(&e))
        }
    }
}
