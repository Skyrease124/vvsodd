// Runs PhotoCraft's engine (WebAssembly, built from editor-engine-bridge/) off the main thread.
//
// Proxy editing: the engine runs single-threaded in the browser, so per-pixel edits on a 12 MP phone photo take
// seconds each. Chat edits therefore run on a copy no larger than PROXY_MAX_SIDE, which the user sees. Download
// replays the same edit plans on the original at full resolution, with pixel-sized parameters scaled up.
//
// The worker keeps the original upload, the proxy bytes and the list of applied plans; "undo" replays every plan
// but the last on a fresh proxy, so the image always matches the plans and memory holds one working document.
//
// Cutout steps (skydata.removeBackground, skydata.region) are done here, not by the engine: the page finds the
// person (lib/cutout.ts) and attaches the mask to the step; this worker scales the mask to the document, blends
// with OffscreenCanvas and opens the result as the new document. The mask stays with the step, so undo, the
// full-size download and My Files apply the same cutout without running the model again.
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

async function reopen() {
  editor?.free();
  editor = null;
  editor = proxyBytes ? new PhotoEditor('proxy.png', proxyBytes) : new PhotoEditor(original.name, original.bytes);
  for (const p of plans) await runPlan(p);
}

const isCutout = (step) => typeof step?.command === 'string' && step.command.startsWith('skydata.');
// Steps that change the picture's size or shape are not allowed inside one part of the photo.
const NOT_IN_REGION = /^(image\.(crop|imageSize|canvasSize|trim|imageRotation\.|rotation\.|mode\.)|filter\.(convertForSmartFilters|vanishingPoint)$|skydata\.|photo\.|select\.)/;

// An area step (photo.area) limits its edits to the subject or the sky (or everything else), using PhotoCraft's
// on-device Select Subject / Select Sky. The selection is made, optionally feathered, the edits run inside it, and it is
// always removed again, so later steps apply to the whole photo.
const AREAS = { subject: ['select.subject', false], sky: ['select.sky', false], notSubject: ['select.subject', true], notSky: ['select.sky', true] };
// Colour and tone areas (PhotoCraft's Color Range, the Magic Wand by colour): "make the reds blue", "brighten the shadows".
for (const c of ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'highlights', 'midtones', 'shadows', 'skinTones']) AREAS[c] = ['select.colorRange', false, { select: c }];
const isArea = (step) => step?.command === 'photo.area';
function runArea(ed, step, run) {
  const area = AREAS[step.params?.area];
  const steps = step.params?.steps;
  if (!area) throw new Error('Choose the subject or the sky.');
  if (!Array.isArray(steps) || !steps.length || steps.length > 12) throw new Error('Say what to change in that part of the photo.');
  for (const s of steps) if (!s || typeof s.command !== 'string' || NOT_IN_REGION.test(s.command) || isArea(s)) throw new Error(`"${String(s?.command).slice(0, 60)}" can't be used on one part of the photo.`);
  const selected = JSON.parse(ed.run(JSON.stringify([{ command: area[0], ...(area[2] ? { params: area[2] } : {}) }]))).done?.[0]?.result;
  try {
    if (area[0] !== 'select.colorRange' && !selected?.selected) throw new Error(area[0] === 'select.sky' ? 'No sky was found in this photo.' : 'No clear subject was found in this photo.');
    if (area[1]) ed.run(JSON.stringify([{ command: 'select.inverse' }]));
    const feather = Number(step.params?.feather ?? 0);
    if (feather > 0) ed.run(JSON.stringify([{ command: 'select.modify.feather', params: { radius: Math.min(250, feather) } }]));
    for (const s of steps) run(ed, s);
  } finally {
    ed.run(JSON.stringify([{ command: 'select.deselect' }]));
  }
}
// A text step (photo.text) adds a caption or title with PhotoCraft's type tool, then flattens the photo again so later
// edits apply to everything. Sizes are relative to the photo, so the full-size download matches the preview.
const isText = (step) => step?.command === 'photo.text';
const TEXT_SIZES = { small: 0.04, medium: 0.065, large: 0.1, huge: 0.15 };
const TEXT_FONTS = { sans: ['Inter', 'Regular'], bold: ['Inter', 'Semi Bold'], mono: ['JetBrains Mono', 'Regular'] };
const TEXT_PLACES = ['top', 'center', 'bottom', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
function runText(ed) {
  return (step) => {
    const p = step.params ?? {};
    const text = typeof p.text === 'string' ? p.text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 200) : '';
    if (!text) throw new Error('Say what the text should be.');
    const place = TEXT_PLACES.includes(p.position) ? p.position : 'bottom';
    const [font, fontStyle] = TEXT_FONTS[p.font] ?? TEXT_FONTS.bold;
    const color = /^#[0-9a-f]{6}$/i.test(String(p.color ?? '')) ? p.color : '#ffffff';
    const { width, height } = info(ed);
    const short = Math.min(width, height);
    const size = Math.max(8, Math.round(short * (TEXT_SIZES[p.size] ?? TEXT_SIZES.medium)));
    const margin = Math.round(short * 0.05);
    const align = /Left$/.test(place) ? 'left' : /Right$/.test(place) ? 'right' : 'center';
    const vertical = p.vertical === true;
    const create = vertical ? { x: margin, y: margin + size, text, font, fontStyle, size, color, orientation: 'vertical' } : { box: [margin, margin, width - 2 * margin, height - 2 * margin], text, font, fontStyle, size, color, align };
    const made = JSON.parse(ed.run(JSON.stringify([{ command: 'type.create', params: create }]))).done?.[0]?.result;
    const b = made?.bounds;
    if (Array.isArray(b) && b.length === 4) {
      // Move the laid-out text to the chosen place (a text box starts at the top; vertical text at the top left).
      const top = /^top/.test(place) ? margin : place === 'center' ? Math.round((height - b[3]) / 2) : height - margin - b[3];
      const left = !vertical ? b[0] : align === 'left' ? margin : align === 'right' ? width - margin - b[2] : Math.round((width - b[2]) / 2);
      if (top !== b[1] || left !== b[0]) ed.run(JSON.stringify([{ command: 'type.edit', params: { move: [left - b[0], top - b[1]] } }]));
    }
    const light = parseInt(color.slice(1, 3), 16) + parseInt(color.slice(3, 5), 16) + parseInt(color.slice(5, 7), 16) > 384;
    const edge = light ? '#000000' : '#ffffff';
    const style = ['plain', 'outline', 'shadow', 'glow'].includes(p.style) ? p.style : 'shadow';
    if (style === 'outline') ed.run(JSON.stringify([{ command: 'layer.layerStyle.stroke', params: { size: Math.max(1, Math.round(size * 0.06)), color: edge, position: 'outside' } }]));
    if (style === 'shadow') ed.run(JSON.stringify([{ command: 'layer.layerStyle.dropShadow', params: { color: '#000000', opacity: 65, distance: Math.max(1, Math.round(size * 0.06)), size: Math.max(2, Math.round(size * 0.14)) } }]));
    if (style === 'glow') ed.run(JSON.stringify([{ command: 'layer.layerStyle.outerGlow', params: { color: edge, opacity: 80, size: Math.max(2, Math.round(size * 0.3)) } }]));
    ed.run(JSON.stringify([{ command: 'layer.flattenImage' }]));
  };
}
// Gradients, shapes and fills (photo.gradient, photo.shape, photo.fill) give positions as fractions of the photo, so the
// AI never needs pixel sizes and the full-size download matches the preview.
const DRAW = new Set(['photo.gradient', 'photo.shape', 'photo.fill']);
const isDraw = (step) => DRAW.has(step?.command);
const hex = (v, fallback) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? v : fallback);
const frac = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
const rgba = (color, opacity) => [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), Math.round(255 * opacity)];
const SHAPE_KINDS = { rectangle: 'rect', roundedRectangle: 'roundedRect', ellipse: 'ellipse', circle: 'ellipse', triangle: 'polygon', polygon: 'polygon', star: 'star', line: 'line' };
const SHAPE_PRESETS = { heart: 'Heart', burst: 'Burst', checkMark: 'Check Mark', cross: 'Cross', plus: 'Plus', ring: 'Ring', lightning: 'Lightning', diamond: 'Diamond', arrowRight: 'Arrow Right', arrowLeft: 'Arrow Left', arrowUp: 'Arrow Up', arrowDown: 'Arrow Down', speechBubble: 'Round Bubble', thoughtBubble: 'Thought Bubble', sun: 'Sun', moon: 'Crescent Moon', raindrop: 'Raindrop', flower: 'Flower' };
function runDraw(ed, step) {
  const p = step.params ?? {};
  const { width: W, height: H } = info(ed);
  const run = (command, params) => ed.run(JSON.stringify([{ command, params }]));
  if (step.command === 'photo.gradient') {
    const color = hex(p.color, '#000000');
    const opacity = Math.round(frac(typeof p.opacity === 'number' ? p.opacity / 100 : undefined, 0.7) * 100);
    const size = Math.max(0.05, frac(p.size, 0.4));
    const where = ['top', 'bottom', 'left', 'right', 'full', 'edges'].includes(p.where) ? p.where : 'bottom';
    if (where === 'full') return run('paint.gradient', { from: [W / 2, 0], to: [W / 2, H], stops: [[0, color], [1, hex(p.color2, color)]], transparency: [[0, opacity], [1, opacity]] });
    if (where === 'edges') return run('paint.gradient', { from: [W / 2, H / 2], to: [0, 0], style: 'radial', stops: [[0, color], [1, color]], transparency: [[Math.max(0, 1 - size), 0], [1, opacity]] });
    const line = { top: [[W / 2, 0], [W / 2, size * H]], bottom: [[W / 2, H], [W / 2, H - size * H]], left: [[0, H / 2], [size * W, H / 2]], right: [[W, H / 2], [W - size * W, H / 2]] }[where];
    return run('paint.gradient', { from: line[0], to: line[1], stops: [[0, color], [1, color]], transparency: [[0, opacity], [1, 0]] });
  }
  if (step.command === 'photo.fill') {
    return run('paint.bucket', { x: Math.round(frac(p.x, 0) * (W - 1)), y: Math.round(frac(p.y, 0) * (H - 1)), color: hex(p.color, '#ffffff'), tolerance: Math.min(255, Math.max(0, Number(p.tolerance) || 32)), contiguous: p.contiguous !== false });
  }
  // photo.shape: a shape layer, then one flat layer again so later edits apply to everything.
  const box = Array.isArray(p.box) && p.box.length === 4 ? p.box.map((v) => frac(v, 0)) : [0.25, 0.25, 0.5, 0.5];
  const rect = [Math.round(box[0] * W), Math.round(box[1] * H), Math.max(2, Math.round(box[2] * W)), Math.max(2, Math.round(box[3] * H))];
  const fill = p.fill === false ? null : rgba(hex(p.color, '#ffffff'), frac(typeof p.opacity === 'number' ? p.opacity / 100 : undefined, 1));
  const short = Math.min(W, H);
  const lineWidth = Math.max(1, Math.round(short * Math.min(0.05, frac(p.outlineWidth, 0.006))));
  const stroke = p.outline ? { width: lineWidth, color: hex(p.outline, '#000000'), align: 'center' } : undefined;
  const preset = SHAPE_PRESETS[p.shape];
  if (preset) run('shape.presets.place', { preset, rect, keepAspect: true, fill, ...(stroke ? { stroke } : {}) });
  else {
    const kind = SHAPE_KINDS[p.shape] ?? 'rect';
    const params = { kind, fill, ...(stroke ? { stroke } : {}) };
    if (kind === 'line') Object.assign(params, { from: [rect[0], rect[1]], to: [rect[0] + rect[2], rect[1] + rect[3]], weight: lineWidth, stroke: { width: lineWidth, color: hex(p.outline ?? p.color, '#ffffff') } });
    else Object.assign(params, { rect }, p.shape === 'triangle' ? { sides: 3 } : kind === 'polygon' ? { sides: Math.min(12, Math.max(3, Math.round(Number(p.sides) || 6))) } : {});
    run('shape.create', params);
  }
  return run('layer.flattenImage', {});
}

const runStep = (ed, step) => (isArea(step) ? runArea(ed, step, runStep) : isText(step) ? runText(ed)(step) : isDraw(step) ? runDraw(ed, step) : ed.run(JSON.stringify([step])));

/** Applies one plan to `editor`, replacing the document when a cutout step makes a new one. */
async function runPlan(plan, engineStep = runStep) {
  if (engineStep === runStep && !plan.some(isCutout) && !plan.some(isArea) && !plan.some(isText) && !plan.some(isDraw)) {
    editor.run(JSON.stringify(plan));
    return;
  }
  for (const step of plan) await applyStep(step, engineStep);
}

async function applyStep(step, engineStep = runStep) {
  if (!isCutout(step)) return engineStep(editor, step);
  const next = await applyCutout(editor, step, engineStep);
  editor.free();
  editor = next;
}

function readMask(mask) {
  if (!mask || !(mask.data instanceof Uint8Array) || !Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1 || mask.width * mask.height !== mask.data.length || mask.data.length > 1024 * 1024 + 4096) throw new Error('This cutout step has no valid mask.');
  return mask;
}

// The mask at the document's size, as the alpha channel of a canvas.
function maskCanvas(mask, width, height) {
  const small = new OffscreenCanvas(mask.width, mask.height);
  const pixels = new ImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) pixels.data[i * 4 + 3] = mask.data[i];
  small.getContext('2d').putImageData(pixels, 0, 0);
  const big = new OffscreenCanvas(width, height);
  const g = big.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, width, height);
  return big;
}

const bitmapOf = (png) => createImageBitmap(new Blob([png], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'default' });

/** A new document: `ed` with the cutout step applied. `ed` itself is left unchanged. */
async function applyCutout(ed, step, onEngineStep) {
  const mask = readMask(step.mask);
  const { width, height } = info(ed);
  const basePng = ed.exportImage('png', 100);
  const base = await bitmapOf(basePng);
  const alpha = maskCanvas(mask, width, height);
  const out = new OffscreenCanvas(width, height);
  const g = out.getContext('2d');
  const masked = (image) => {
    const layer = new OffscreenCanvas(width, height);
    const l = layer.getContext('2d');
    l.drawImage(image, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(alpha, 0, 0);
    return layer;
  };
  if (step.command === 'skydata.removeBackground') {
    const color = step.params?.color;
    if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(String(color))) throw new Error('The background colour must look like #ffffff.');
    if (color) {
      g.fillStyle = color;
      g.fillRect(0, 0, width, height);
    }
    g.drawImage(masked(base), 0, 0);
  } else if (step.command === 'skydata.region') {
    const steps = step.params?.steps;
    if (!Array.isArray(steps) || !steps.length || steps.length > 12) throw new Error('Say what to change in that part of the photo.');
    for (const s of steps) if (!s || typeof s.command !== 'string' || NOT_IN_REGION.test(s.command)) throw new Error(`"${String(s?.command).slice(0, 60)}" can't be used on one part of the photo.`);
    const other = new PhotoEditor('part.png', basePng);
    let otherPng;
    try {
      for (const s of steps) onEngineStep(other, s);
      const i = info(other);
      if (i.width !== width || i.height !== height) throw new Error('An edit inside one part of the photo cannot change its size.');
      otherPng = other.exportImage('png', 100);
    } finally {
      other.free();
    }
    const edited = await bitmapOf(otherPng);
    g.drawImage(base, 0, 0);
    g.drawImage(masked(edited), 0, 0);
    edited.close?.();
  } else {
    throw new Error(`Unknown cutout step ${step.command}.`);
  }
  base.close?.();
  const png = new Uint8Array(await (await out.convertToBlob({ type: 'image/png' })).arrayBuffer());
  return new PhotoEditor('cutout.png', png);
}


function state() {
  const i = info(editor);
  const k = proxyBytes ? original.width / proxyInfo.width : 1;
  // See-through after a background removal without a colour (later colour fills cover it again).
  let transparent = false;
  for (const s of plans.flat()) if (s.command === 'skydata.removeBackground') transparent = !s.params?.color;
  return { info: i, steps: plans.length, scale: k, full: { width: original.width, height: original.height }, transparent };
}

function preview() {
  return new Blob([editor.preview(PREVIEW_MAX_SIDE)], { type: 'image/png' });
}

// A proxy-space step converted to full-resolution parameters.
function scaleStep(step, k, doc) {
  if (k === 1 || !step.params) return step;
  // A part-of-the-photo step: scale the edits inside it (the mask is resolution-independent).
  if ((step.command === 'skydata.region' || isArea(step)) && Array.isArray(step.params.steps)) return { ...step, params: { ...step.params, ...(typeof step.params.feather === 'number' ? { feather: Math.round(step.params.feather * k * 100) / 100 } : {}), steps: step.params.steps.map((s) => scaleStep(s, k, doc)) } };
  if (isCutout(step)) return step;
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
            await applyStep(step, isCutout(step) ? runClamped : runStep);
            ok.push(step);
            dropped.push(...left);
            break;
          } catch (e) {
            const error = errorText(e);
            await reopen();
            if (ok.length) await runPlan(ok);
            const key = /`(\w+)` must /.exec(error)?.[1];
            if (!isCutout(step) && attempt < 8 && key && step.params && Object.hasOwn(step.params, key)) {
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
      await runPlan(steps);
      plans.push(steps);
      return { ...state(), done: steps.map((s) => s.command), preview: preview() };
    } catch (e) {
      // A plan that fails part-way is rolled back, so the image always matches the applied plans.
      await reopen();
      throw e;
    }
  },
  // The picture after `steps` (not kept), for the page to find the person in before a cutout step.
  async snapshot({ steps = [] }) {
    if (!editor) throw new Error('Upload a photo first.');
    const current = editor;
    editor = new PhotoEditor('snapshot.png', current.exportImage('png', 100));
    try {
      await runPlan(steps);
      return { preview: preview() };
    } finally {
      editor.free();
      editor = current;
    }
  },
  // My Files: what is needed to save the photo so it can be reopened and edited further.
  async source() {
    if (!editor) throw new Error('Upload a photo first.');
    return { name: original.name, bytes: original.bytes.slice(), plans: structuredClone(plans) };
  },
  // Reopening a saved file: apply its saved edits again, each kept as its own undo step.
  async restore({ plans: saved }) {
    if (!editor) throw new Error('Upload a photo first.');
    try {
      for (const plan of saved) {
        await runPlan(plan);
        plans.push(plan);
      }
    } catch (e) {
      plans = [];
      await reopen();
      throw e;
    }
    return { ...state(), preview: preview() };
  },
  async undo() {
    if (!editor || plans.length === 0) throw new Error('Nothing to undo.');
    plans.pop();
    await reopen();
    return { ...state(), preview: preview() };
  },
  async export({ format, quality }) {
    if (!editor) throw new Error('Upload a photo first.');
    if (!proxyBytes) return { blob: blob(editor.exportImage(format, quality), format), width: info(editor).width, height: info(editor).height };
    // Full-resolution render: replay every plan on the original, one step at a time.
    const k = original.width / proxyInfo.width;
    let full = new PhotoEditor(original.name, original.bytes);
    try {
      for (const plan of plans) {
        for (const step of plan) {
          const scaled = scaleStep(step, k, info(full));
          if (!isCutout(scaled)) {
            runClamped(full, scaled);
            continue;
          }
          const next = await applyCutout(full, scaled, runClamped);
          full.free();
          full = next;
        }
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
  if (isArea(step)) return runArea(ed, step, runClamped);
  if (isText(step)) return runText(ed)(step);
  if (isDraw(step)) return runDraw(ed, step);
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

// Requests run one at a time: cutout steps wait for the browser, and two requests must not edit the same document.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    const { id, type, payload } = data;
    const started = performance.now();
    try {
      await load();
      if (!Object.hasOwn(handlers, type)) throw new Error('Unknown request.');
      const result = await handlers[type](payload ?? {});
      self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - started) });
    } catch (e) {
      self.postMessage({ id, ok: false, error: errorText(e), ms: Math.round(performance.now() - started) });
    }
  });
};
