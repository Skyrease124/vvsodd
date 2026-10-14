// Chat UI for the prototype: upload → message → edit plan → engine (in a worker) → preview → download.
import { planWithRules } from './planner.js';

const $ = (id) => document.getElementById(id);
const log = $('log');
const prompt = $('prompt');
const send = $('send');
const status = $('status');

// The browser's own decoder is the fallback for files the engine cannot open (for example HEIC on iPhone),
// limited to the canvas area iOS Safari allows.
const CANVAS_MAX_PIXELS = 16_000_000;

const worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module' });
let nextId = 1;
const pending = new Map();
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  data.ok ? p.resolve({ ...data.result, ms: data.ms }) : p.reject(Object.assign(new Error(data.error), { ms: data.ms }));
};
worker.onerror = (e) => {
  status.textContent = `The editing engine failed to start: ${e.message || 'unknown error'}`;
};
function call(type, payload, transfer = []) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload }, transfer);
  });
}

let ctx = null; // { width, height, steps, name }
let busy = false;
const urls = [];

function bubble(text, cls = '') {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  el.textContent = text;
  log.append(el);
  el.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return el;
}

function addImage(el, blob, meta) {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Edited preview';
  el.append(img);
  if (meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = meta;
    el.append(m);
  }
  img.onload = () => el.scrollIntoView({ block: 'end', behavior: 'smooth' });
}

function addActions(el) {
  const row = document.createElement('div');
  row.className = 'row';
  const mk = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    row.append(b);
  };
  mk('Undo', () => submit('undo'));
  mk('Download JPG', () => download('jpg'));
  mk('Download PNG', () => download('png'));
  el.append(row);
}

function setBusy(on, text) {
  busy = on;
  prompt.disabled = on || !ctx;
  send.disabled = on || !ctx;
  const proxy = ctx && ctx.scale > 1 ? ` (preview of a ${ctx.full.width}×${ctx.full.height} photo; downloads are full size)` : '';
  status.textContent = text ?? (ctx ? `${ctx.width}×${ctx.height} px · ${ctx.steps} edit${ctx.steps === 1 ? '' : 's'} applied${proxy}` : 'Ready. Upload a photo to start.');
}

async function browserDecode(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(CANVAS_MAX_PIXELS / (bitmap.width * bitmap.height)));
  const w = Math.max(1, Math.floor(bitmap.width * scale));
  const h = Math.max(1, Math.floor(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  canvas.width = canvas.height = 0;
  return { blob, scaled: scale < 1 };
}

// iPhone JPEGs usually store rotation as an EXIF tag. Returns 1 (none) when absent or not a JPEG.
function jpegOrientation(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o);
    const len = v.getUint16(o + 2);
    if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
      const t = o + 10;
      const le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le);
      const n = v.getUint16(ifd, le);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > v.byteLength) break;
        if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    o += 2 + len;
  }
  return 1;
}

async function openFile(file) {
  if (!file) return;
  const me = bubble(`📷 ${file.name || 'photo'} (${(file.size / 1048576).toFixed(1)} MB)`, 'me');
  setBusy(true, 'Opening the photo…');
  try {
    let bytes = new Uint8Array(await file.arrayBuffer());
    let name = file.name || 'photo.jpg';
    let note = '';
    // Let the browser apply EXIF rotation, so the photo is the right way up.
    if (jpegOrientation(bytes) !== 1) {
      const d = await browserDecode(file);
      bytes = new Uint8Array(await d.blob.arrayBuffer());
      name = name.replace(/\.\w+$/, '') + '.png';
      note = d.scaled ? ' (rotated upright and reduced to fit this browser)' : ' (rotated upright)';
    }
    let res;
    try {
      res = await call('open', { name, bytes: bytes.buffer }, [bytes.buffer]);
    } catch (e) {
      // HEIC and other formats the engine does not read: decode with the browser, then retry as PNG.
      const d = await browserDecode(file);
      const png = new Uint8Array(await d.blob.arrayBuffer());
      res = await call('open', { name: (file.name || 'photo').replace(/\.\w+$/, '') + '.png', bytes: png.buffer }, [png.buffer]);
      note = d.scaled ? ' (converted by the browser and reduced to fit)' : ' (converted by the browser)';
    }
    ctx = { width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full, name: file.name || 'photo' };
    addImage(me, res.preview, `${res.full.width}×${res.full.height} px${note} · opened in ${res.ms} ms`);
    bubble('Got it. What would you like to change?');
  } catch (e) {
    bubble(`Could not open this photo: ${e.message}`, 'err');
  } finally {
    setBusy(false);
  }
}

async function submit(text) {
  text = text.trim();
  if (!text || busy) return;
  if (!ctx) {
    bubble('Upload a photo first (📷).', 'err');
    return;
  }
  if (text !== 'undo') bubble(text, 'me');
  const plan = text === 'undo' ? { undo: true } : planWithRules(text, ctx);
  if (!plan.undo && plan.steps.length === 0) {
    bubble(plan.reply);
    return;
  }
  setBusy(true, plan.undo ? 'Undoing…' : 'Editing…');
  try {
    const res = plan.undo ? await call('undo') : await call('run', { steps: plan.steps });
    ctx = { ...ctx, width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full };
    const el = bubble(plan.undo ? 'Undid the last edit.' : plan.reply);
    addImage(el, res.preview, `${res.info.width}×${res.info.height} px · ${res.ms} ms`);
    addActions(el);
  } catch (e) {
    bubble(e.message, 'err');
  } finally {
    setBusy(false);
    prompt.focus({ preventScroll: true });
  }
}

async function download(format) {
  if (!ctx || busy) return;
  setBusy(true, ctx.scale > 1 ? `Rendering the full-size ${format.toUpperCase()}; large photos can take a while…` : `Preparing ${format.toUpperCase()}…`);
  try {
    const { blob, width, height, ms } = await call('export', { format, quality: 92 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ctx.name.replace(/\.\w+$/, '')}-edited.${format}`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    bubble(`Saved ${a.download}: ${width}×${height} px, ${(blob.size / 1048576).toFixed(1)} MB, rendered in ${(ms / 1000).toFixed(1)} s.`);
  } catch (e) {
    bubble(`Download failed: ${e.message}`, 'err');
  } finally {
    setBusy(false);
  }
}

for (const s of ['auto enhance', 'brighter', 'more contrast', 'black and white', 'warmer', 'vibrant', 'sharpen', 'square crop', 'rotate right', 'blur 4']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s;
  b.onclick = () => submit(s);
  $('chips').append(b);
}
$('file').addEventListener('change', (e) => {
  openFile(e.target.files[0]);
  e.target.value = '';
});
$('bar').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = prompt.value;
  prompt.value = '';
  submit(t);
});

// Keep the last message clear of the fixed input bar, whose height changes with the status line and chips.
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${$('bar').offsetHeight}px`)).observe($('bar'));

const t0 = performance.now();
call('catalog')
  .then((cat) => {
    window.__engine = { commands: cat.commands.length, loadMs: Math.round(performance.now() - t0), stats: () => call('stats') };
    setBusy(false);
  })
  .catch((e) => {
    status.textContent = `The editing engine failed to load: ${e.message}`;
  });
