// Runs PhotoCraft's engine (WebAssembly, built from creative-engine-poc/bridge on branch claude/creative-engine-poc) off the main thread.
//
// Proxy editing: the engine runs single-threaded in the browser, so per-pixel edits on a 12 MP phone photo take
// seconds each. Chat edits therefore run on a copy no larger than PROXY_MAX_SIDE, which the user sees. Download
// replays the same edit plans on the original at full resolution, with pixel-sized parameters scaled up.
//
// The worker keeps the original upload, the proxy bytes and the list of applied plans; "undo" replays every plan
// but the last on a fresh proxy, so the image always matches the plans and memory holds one working document.
import init, { PhotoEditor, commandCatalog } from './pkg/skydata_photocraft_bridge.js';

const PROXY_MAX_SIDE = 1600;
const PREVIEW_MAX_SIDE = 1024;
// Parameters measured in pixels: multiplied by the full-size/proxy ratio for the download render.
const PIXEL_PARAMS = ['x', 'y', 'width', 'height', 'targetWidth', 'targetHeight', 'radius', 'distance', 'cellSize', 'maxRadius', 'tileSize', 'groutWidth'];
const GEOMETRY = ['x', 'y', 'width', 'height', 'targetWidth', 'targetHeight'];
const SIZE_COMMANDS = new Set(['image.crop', 'image.imageSize', 'image.canvasSize']);

let ready = null;
let original = null; // { name, bytes, width, height }
let proxyBytes = null; // PNG of the proxy, or null when the original is small enough to edit directly
let editor = null; // the proxy (or original) the chat edits
let plans = [];
let proxyInfo = null; // size of the proxy when it was made

let wasm = null;
function load() {
  ready ??= init({ module_or_path: new URL('./pkg/skydata_photocraft_bridge_bg.wasm', import.meta.url) }).then((w) => (wasm = w));
  return ready;
}

const info = (ed) => JSON.parse(ed.info());

function reopen() {
  editor?.free();
  editor = null;
  editor = proxyBytes ? new PhotoEditor('proxy.png', proxyBytes) : new PhotoEditor(original.name, original.bytes);
  for (const p of plans) editor.run(JSON.stringify(p));
}


function state() {
  const i = info(editor);
  const k = proxyBytes ? original.width / proxyInfo.width : 1;
  return { info: i, steps: plans.length, scale: k, full: { width: original.width, height: original.height } };
}

function preview() {
  return new Blob([editor.preview(PREVIEW_MAX_SIDE)], { type: 'image/png' });
}

// A proxy-space step converted to full-resolution parameters.
function scaleStep(step, k, doc) {
  if (k === 1 || !step.params) return step;
  const params = structuredClone(step.params);
  const sizeCommand = SIZE_COMMANDS.has(step.command);
  for (const key of PIXEL_PARAMS) {
    if (typeof params[key] !== 'number') continue;
    // x/y/width/height are pixel sizes only for crop and size commands (emboss `height`, for example, is not).
    if (GEOMETRY.includes(key) && !sizeCommand) continue;
    params[key] = sizeCommand ? Math.round(params[key] * k) : Math.round(params[key] * k * 100) / 100;
  }
  if (step.command === 'image.crop') {
    // Rounding must not push the crop past the full-size edge.
    params.x = Math.max(0, Math.min(params.x ?? 0, doc.width - 1));
    params.y = Math.max(0, Math.min(params.y ?? 0, doc.height - 1));
    if (params.width) params.width = Math.min(params.width, doc.width - params.x);
    if (params.height) params.height = Math.min(params.height, doc.height - params.y);
  }
  return { ...step, params };
}

const handlers = {
  // WebAssembly memory only grows; on iPhone this is the number to watch.
  async stats() {
    return { wasmMemoryMB: Math.round(wasm.memory.buffer.byteLength / 1048576) };
  },
  async catalog() {
    return { commands: JSON.parse(commandCatalog()) };
  },
  async open({ name, bytes }) {
    editor?.free();
    editor = null;
    plans = [];
    proxyBytes = null;
    const full = new PhotoEditor(name, new Uint8Array(bytes));
    const i = info(full);
    original = { name, bytes: new Uint8Array(bytes), width: i.width, height: i.height };
    if (Math.max(i.width, i.height) > PROXY_MAX_SIDE) {
      proxyBytes = full.preview(PROXY_MAX_SIDE);
      full.free();
      editor = new PhotoEditor('proxy.png', proxyBytes);
      proxyInfo = info(editor);
    } else {
      editor = full;
      proxyInfo = i;
    }
    return { ...state(), preview: preview() };
  },
  async run({ steps, skipFailing }) {
    if (!editor) throw new Error('Upload a photo first.');
    if (skipFailing) {
      // AI-planned edits: a step the engine rejects is left out (and reported) instead of failing the whole edit.
      // A setting the engine names as wrong ("`reds` must be an object") is dropped and the step tried again.
      const ok = [];
      const skipped = [];
      const dropped = [];
      for (const original of steps) {
        let step = original;
        const left = [];
        for (let attempt = 0; ; attempt++) {
          try {
            editor.run(JSON.stringify([step]));
            ok.push(step);
            dropped.push(...left);
            break;
          } catch (e) {
            const error = errorText(e);
            reopen();
            if (ok.length) editor.run(JSON.stringify(ok));
            const key = /`(\w+)` must /.exec(error)?.[1];
            if (attempt < 8 && key && step.params && Object.hasOwn(step.params, key)) {
              const params = { ...step.params };
              // An out-of-range number is brought into range ("must be a number in 0.1..1000"); anything else is dropped.
              const range = /must be a number in (-?[\d.]+)\.\.(-?[\d.]+)/.exec(error);
              const value = params[key];
              if (range && typeof value === 'number' && (value < +range[1] || value > +range[2])) params[key] = Math.min(+range[2], Math.max(+range[1], value));
              else {
                delete params[key];
                left.push({ command: step.command, param: key });
              }
              step = { ...step, params };
              continue;
            }
            skipped.push({ command: step.command, error });
            break;
          }
        }
      }
      if (!ok.length) throw new Error(skipped[0]?.error ?? 'Nothing to apply.');
      plans.push(ok);
      return { ...state(), done: ok.map((s) => s.command), skipped, dropped, preview: preview() };
    }
    try {
      const out = JSON.parse(editor.run(JSON.stringify(steps)));
      plans.push(steps);
      return { ...state(), done: out.done, preview: preview() };
    } catch (e) {
      // A plan that fails part-way is rolled back, so the image always matches the applied plans.
      reopen();
      throw e;
    }
  },
  async undo() {
    if (!editor || plans.length === 0) throw new Error('Nothing to undo.');
    plans.pop();
    reopen();
    return { ...state(), preview: preview() };
  },
  async export({ format, quality }) {
    if (!editor) throw new Error('Upload a photo first.');
    if (!proxyBytes) return { blob: blob(editor.exportImage(format, quality), format), width: info(editor).width, height: info(editor).height };
    // Full-resolution render: replay every plan on the original, one step at a time.
    const k = original.width / proxyInfo.width;
    const full = new PhotoEditor(original.name, original.bytes);
    try {
      for (const plan of plans) {
        for (const step of plan) runClamped(full, scaleStep(step, k, info(full)));
      }
      const i = info(full);
      return { blob: blob(full.exportImage(format, quality), format), width: i.width, height: i.height };
    } finally {
      full.free();
    }
  },
};

// Scaling a pixel setting up for the full-size render can pass the engine's limit ("must be a number in 0.1..1000"):
// bring it back to the limit and run the step again.
function runClamped(ed, step) {
  try {
    ed.run(JSON.stringify([step]));
  } catch (e) {
    const error = errorText(e);
    const m = /`(\w+)` must be a number in (-?[\d.]+)\.\.(-?[\d.]+)/.exec(error);
    const value = m && step.params?.[m[1]];
    if (typeof value !== 'number') throw e;
    ed.run(JSON.stringify([{ ...step, params: { ...step.params, [m[1]]: Math.min(+m[3], Math.max(+m[2], value)) } }]));
  }
}

// Engine errors arrive as JSON text ({"done":[],"error":"…"}).
function errorText(e) {
  const message = e?.message ?? String(e);
  try {
    return JSON.parse(message).error ?? message;
  } catch {
    return message;
  }
}

const blob = (bytes, format) => new Blob([bytes], { type: format === 'png' ? 'image/png' : 'image/jpeg' });

self.onmessage = async ({ data }) => {
  const { id, type, payload } = data;
  const started = performance.now();
  try {
    await load();
    const result = await handlers[type](payload ?? {});
    self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - started) });
  } catch (e) {
    self.postMessage({ id, ok: false, error: errorText(e), ms: Math.round(performance.now() - started) });
  }
};
