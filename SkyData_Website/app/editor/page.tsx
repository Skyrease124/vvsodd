'use client';
// SkyData Editor: upload a photo, describe the edit, preview, undo and download. Everything runs in the browser
// (PhotoCraft's engine as WebAssembly in a Web Worker, public/editor-engine/); photos are never uploaded.
// The engine starts when this page opens and is shut down when it closes, so it holds no memory elsewhere.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Download, FolderOpen, Save, Undo2 } from 'lucide-react';
import { planWithRules, type EditPlan, type EditStep } from '../../lib/editor-planner';
import { makeThumb, readFile, saveFile, takeHandOff } from '../../lib/creative-files';
import { closeCutout, cutoutMask, type CutoutRegion } from '../../lib/cutout';
import './editor.css';

type Info = { width: number; height: number };
type EngineState = { info: Info; steps: number; scale: number; full: Info; transparent?: boolean; preview?: Blob; skipped?: { command: string; error: string }[]; dropped?: { command: string; param: string }[] };
// "image.adjustments.colorBalance" → "color balance"
const stepName = (id: string) => (id.split('.').pop() ?? id).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
type Msg = { id: number; who: 'me' | 'sky' | 'err'; text: string; image?: string; meta?: string; actions?: boolean; filesLink?: boolean };
type Photo = { name: string; width: number; height: number; steps: number; scale: number; full: Info; transparent?: boolean };
const isCutout = (s: EditStep) => s.command.startsWith('skydata.');
const PART_NAMES: Record<CutoutRegion, string> = { background: 'a background', person: 'a person', hair: 'hair', face: 'a face', skin: 'skin', clothes: 'clothes' };

// The browser's own decoder is the fallback for files the engine cannot open (HEIC on iPhone), limited to the
// canvas area iOS Safari allows.
const CANVAS_MAX_PIXELS = 16_000_000;
const CHIPS = ['blur background', 'remove background', 'auto enhance', 'brighter', 'more contrast', 'black and white', 'smooth skin', 'warmer', 'vibrant', 'sharpen', 'square crop', 'rotate right'];

async function browserDecode(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, Math.sqrt(CANVAS_MAX_PIXELS / (bitmap.width * bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
  canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not read this photo.'))), 'image/png'));
  canvas.width = canvas.height = 0;
  return { blob, scaled: scale < 1 };
}

// iPhone JPEGs usually store rotation as an EXIF tag. Returns 1 (none) when absent or not a JPEG.
function jpegOrientation(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  for (let o = 2; o + 4 < v.byteLength; ) {
    const marker = v.getUint16(o);
    const len = v.getUint16(o + 2);
    if (marker === 0xffe1 && o + 10 < v.byteLength && v.getUint32(o + 4) === 0x45786966) {
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

export default function Editor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading the editor…');
  const [input, setInput] = useState('');
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>());
  const nextId = useRef(1);
  const urls = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  // My Files: the saved file this photo came from (saving again updates it) and the latest preview (its thumbnail).
  const savedId = useRef<string | null>(null);
  const lastPreview = useRef<Blob | null>(null);

  function call<T = EngineState & { ms: number }>(type: string, payload?: unknown, transfer: Transferable[] = []): Promise<T> {
    const id = nextId.current++;
    return new Promise((resolve, reject) => {
      if (!worker.current) return reject(new Error('The editor is not running.'));
      pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.current.postMessage({ id, type, payload }, transfer);
    });
  }

  useEffect(() => {
    const w = new Worker('/editor-engine/engine-worker.js', { type: 'module' });
    worker.current = w;
    w.onmessage = ({ data }) => {
      const p = pending.current.get(data.id);
      if (!p) return;
      pending.current.delete(data.id);
      if (data.ok) p.resolve({ ...data.result, ms: data.ms });
      else p.reject(Object.assign(new Error(data.error), { ms: data.ms }));
    };
    w.onerror = () => setStatus('The editor could not start in this browser.');
    call('catalog')
      .then(() => {
        setReady(true);
        setStatus('Ready. Upload a photo to start.');
      })
      .catch((e) => setStatus('The editor could not start: ' + e.message));
    const created = urls.current;
    return () => {
      // Leaving the page frees all of the engine's memory.
      w.terminate();
      void closeCutout();
      worker.current = null;
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, []);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  const add = (m: Omit<Msg, 'id'>) => setMessages((list) => [...list, { ...m, id: nextId.current++ }]);
  const imageUrl = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urls.current.push(u);
    return u;
  };
  const describe = (p: Photo) => `${p.width}×${p.height} px · ${p.steps} edit${p.steps === 1 ? '' : 's'}` + (p.scale > 1 ? ` (preview of a ${p.full.width}×${p.full.height} photo; downloads are full size)` : '');

  async function openFile(file: File): Promise<boolean> {
    setBusy(true);
    setStatus('Opening the photo…');
    const label = `📷 ${file.name || 'photo'} (${(file.size / 1048576).toFixed(1)} MB)`;
    try {
      let bytes = new Uint8Array(await file.arrayBuffer());
      let name = file.name || 'photo.jpg';
      let note = '';
      if (jpegOrientation(bytes) !== 1) {
        const d = await browserDecode(file);
        bytes = new Uint8Array(await d.blob.arrayBuffer());
        name = name.replace(/\.\w+$/, '') + '.png';
        note = d.scaled ? ' (turned upright and reduced to fit this browser)' : ' (turned upright)';
      }
      let res;
      try {
        res = await call('open', { name, bytes: bytes.buffer }, [bytes.buffer]);
      } catch {
        // HEIC and other formats the engine does not read: let the browser decode it, then open it as PNG.
        const d = await browserDecode(file);
        const png = new Uint8Array(await d.blob.arrayBuffer());
        res = await call('open', { name: (file.name || 'photo').replace(/\.\w+$/, '') + '.png', bytes: png.buffer }, [png.buffer]);
        note = d.scaled ? ' (converted by the browser and reduced to fit)' : ' (converted by the browser)';
      }
      const p = { name: file.name || 'photo', width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full };
      savedId.current = null;
      lastPreview.current = res.preview!;
      setPhoto(p);
      add({ who: 'me', text: label, image: imageUrl(res.preview!), meta: `${res.full.width}×${res.full.height} px${note}` });
      add({ who: 'sky', text: 'Got it. What would you like to change?' });
      setStatus(describe(p));
      return true;
    } catch (e) {
      add({ who: 'me', text: label });
      add({ who: 'err', text: 'Could not open this photo: ' + (e as Error).message });
      setStatus(photo ? describe(photo) : 'Ready. Upload a photo to start.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (!photo) {
      add({ who: 'err', text: 'Upload a photo first (camera button).' });
      return;
    }
    const isUndo = text === 'undo';
    let plan: EditPlan = isUndo ? { undo: true } : planWithRules(text, photo);
    let fromAi = false;
    if (!isUndo) add({ who: 'me', text });
    setBusy(true);
    // Common phrases are planned instantly on the device; anything else goes to SkyData's AI planner. If the AI is
    // unavailable, whatever the phrases understood is still applied.
    if (!plan.undo && !plan.complete) {
      setStatus('Asking SkyData AI how to edit it…');
      const ai = await aiPlan(text, photo);
      if ('steps' in ai) {
        const art = ai.leftOut?.length ? ` (Left out an art effect you didn't ask for: ${ai.leftOut.map(stepName).join(', ')}.)` : '';
        plan = { steps: ai.steps, reply: ai.reply + art, complete: true };
        fromAi = true;
      }
      else if (plan.steps.length) plan = { ...plan, reply: `${plan.reply} (SkyData AI was unavailable: ${ai.error})` };
      else plan = { steps: [], reply: `${ai.error} You can still use phrases like: brighter, black and white, warmer, sharpen, square crop, rotate right, blur 4, auto enhance.`, complete: true };
    }
    if (!plan.undo && plan.steps.length === 0) {
      add({ who: 'sky', text: plan.reply });
      setBusy(false);
      setStatus(describe(photo));
      return;
    }
    setStatus(plan.undo ? 'Undoing…' : 'Editing…');
    try {
      // People-photo steps: find the person first (on this device), on the picture as it will be at that step.
      if (!plan.undo && plan.steps.some(isCutout)) plan = { ...plan, steps: await withMasks(plan.steps) };
      // AI plans may contain a step the engine rejects; that step is skipped and named, the rest still applies.
      const res = plan.undo ? await call('undo') : await call('run', { steps: plan.steps as EditStep[], skipFailing: fromAi });
      const p = { ...photo, width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full, transparent: res.transparent };
      lastPreview.current = res.preview!;
      setPhoto(p);
      const skipped = res.skipped?.length ? ` (Skipped ${res.skipped.length === 1 ? 'one step' : res.skipped.length + ' steps'} the editor couldn't apply: ${res.skipped.map((k) => stepName(k.command)).join(', ')}.)` : '';
      const dropped = res.dropped?.length ? ` (Left out settings the editor couldn't use: ${res.dropped.map((d) => `${d.param} in ${stepName(d.command)}`).join(', ')}.)` : '';
      add({ who: 'sky', text: plan.undo ? 'Undid the last edit.' : plan.reply + dropped + skipped, image: imageUrl(res.preview!), meta: `${res.info.width}×${res.info.height} px · ${res.ms} ms`, actions: true });
      setStatus(describe(p));
    } catch (e) {
      add({ who: 'err', text: (e as Error).message });
      setStatus(describe(photo));
    } finally {
      setBusy(false);
    }
  }

  // Attaches the person's mask to each people-photo step. The model runs on the picture as it will be just before
  // that step, so earlier steps in the same edit (a crop, another cutout) are taken into account.
  async function withMasks(steps: EditStep[]): Promise<EditStep[]> {
    const out: EditStep[] = [];
    let first = true;
    for (const step of steps) {
      if (!isCutout(step)) {
        out.push(step);
        continue;
      }
      setStatus(first ? 'Finding the person in the photo… (the first time, this loads the cutout tool, about 30 MB)' : 'Finding the person in the photo…');
      first = false;
      const region = (step.command === 'skydata.removeBackground' ? 'person' : String(step.params?.region ?? 'person')) as CutoutRegion;
      const { preview } = await call<{ preview: Blob }>('snapshot', { steps: out });
      const mask = await cutoutMask(preview, region);
      // A photo without people still gets a faint guess; at least 3% of it must clearly be a person (0.1% for a part).
      const share = region === 'background' ? 1 - mask.coverage : mask.coverage;
      if (share < (region === 'background' || region === 'person' ? 0.03 : 0.001)) throw new Error(`I couldn't find ${region === 'background' || region === 'person' ? 'a person' : PART_NAMES[region]} in this photo. The background and touch-up tools work on photos of people.`);
      out.push({ ...step, mask: { width: mask.width, height: mask.height, data: mask.data } });
    }
    setStatus('Editing…');
    return out;
  }

  async function aiPlan(message: string, p: Photo): Promise<{ steps: EditStep[]; reply: string; leftOut?: string[] } | { error: string }> {
    try {
      const r = await fetch('/api/editor-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, width: p.width, height: p.height }) });
      const data = (await r.json().catch(() => ({}))) as { steps?: EditStep[]; reply?: string; leftOut?: string[]; error?: string };
      if (r.ok && Array.isArray(data.steps)) return { steps: data.steps, reply: data.reply || 'Done.', leftOut: data.leftOut };
      return { error: data.error || 'SkyData AI could not plan that edit.' };
    } catch {
      return { error: 'SkyData AI could not be reached.' };
    }
  }

  // Save to My Files: the full-size JPG, plus the original photo and its edit steps so it can be edited further.
  async function saveToFiles() {
    if (!photo || busy) return;
    setBusy(true);
    setStatus(photo.scale > 1 ? 'Saving the full-size photo to My Files; large photos can take a while…' : 'Saving to My Files…');
    try {
      // A see-through photo is kept as PNG (JPG has no transparency).
      const { blob, width, height } = await call<{ blob: Blob; width: number; height: number }>('export', { format: photo.transparent ? 'png' : 'jpg', quality: 92 });
      const src = await call<{ name: string; bytes: Uint8Array; plans: EditStep[][] }>('source');
      const thumb = await makeThumb(lastPreview.current ?? blob);
      const updating = savedId.current;
      const item = await saveFile({ id: updating ?? undefined, name: photo.name.replace(/\.\w+$/, ''), width, height, thumb, originalName: src.name, original: new Blob([src.bytes as BlobPart]), plans: src.plans, image: blob });
      savedId.current = item.id;
      add({ who: 'sky', text: `${updating ? 'Updated' : 'Saved'} "${item.name}" in My Files (${width}×${height} px). It's stored on this device only.`, filesLink: true });
    } catch (e) {
      add({ who: 'err', text: 'Could not save to My Files: ' + (e as Error).message });
    } finally {
      setBusy(false);
      setStatus(describe(photo));
    }
  }

  // Opened from My Files (/editor?file=…): the original photo with its saved edits applied again, ready to keep editing.
  async function openSaved(id: string, saved: Awaited<ReturnType<typeof readFile>>) {
    setBusy(true);
    setStatus('Opening from My Files…');
    try {
      if (!saved) throw new Error('That file is no longer on this device.');
      const bytes = new Uint8Array(await saved.data.original.arrayBuffer());
      let res = await call('open', { name: saved.data.originalName, bytes: bytes.buffer }, [bytes.buffer]);
      if (saved.data.plans.length) res = await call('restore', { plans: saved.data.plans });
      const p = { name: saved.item.name, width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full, transparent: res.transparent };
      savedId.current = id;
      lastPreview.current = res.preview!;
      setPhoto(p);
      add({ who: 'sky', text: `Opened "${saved.item.name}" from My Files with its ${saved.data.plans.length === 1 ? 'edit' : saved.data.plans.length + ' edits'}. Keep editing, then save again to update it.`, image: imageUrl(res.preview!), meta: `${res.full.width}×${res.full.height} px`, actions: true });
      setStatus(describe(p));
    } catch (e) {
      add({ who: 'err', text: 'Could not open from My Files: ' + (e as Error).message });
      setStatus('Ready. Upload a photo to start.');
    } finally {
      setBusy(false);
    }
  }

  // /editor?file=… opens that saved file once the engine is ready.
  const openedSaved = useRef(false);
  useEffect(() => {
    if (!ready || openedSaved.current) return;
    openedSaved.current = true;
    const query = new URLSearchParams(location.search);
    // From the chat's "Edit in Editor": the photo waits in this device's hand-off spot.
    if (query.get('from') === 'chat')
      takeHandOff()
        .then(async (h) => { (h ? await openFile(new File([h.photo], h.name, { type: h.photo.type || 'image/jpeg' })) : add({ who: 'err', text: 'The photo from the chat is no longer waiting. Go back to the chat and tap Edit in Editor again.' })); })
        .catch((e: Error) => add({ who: 'err', text: 'Could not open the photo from the chat: ' + e.message }));
    const id = query.get('file');
    if (id)
      readFile(id)
        .then((saved) => openSaved(id, saved))
        .catch((e: Error) => add({ who: 'err', text: 'Could not open from My Files: ' + e.message }));
  });

  async function download(format: 'jpg' | 'png') {
    if (!photo || busy) return;
    setBusy(true);
    setStatus(photo.scale > 1 ? `Rendering the full-size ${format.toUpperCase()}; large photos can take a while…` : `Preparing ${format.toUpperCase()}…`);
    try {
      const { blob, width, height, ms } = await call<{ blob: Blob; width: number; height: number; ms: number }>('export', { format, quality: 92 });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${photo.name.replace(/\.\w+$/, '')}-edited.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const note = photo.transparent && format === 'jpg' ? ' JPG cannot be see-through, so the background is white; use Download PNG to keep it see-through.' : '';
      add({ who: 'sky', text: `Saved ${a.download}: ${width}×${height} px, ${(blob.size / 1048576).toFixed(1)} MB, rendered in ${(ms / 1000).toFixed(1)} s.${note}` });
    } catch (e) {
      add({ who: 'err', text: 'Download failed: ' + (e as Error).message });
    } finally {
      setBusy(false);
      setStatus(describe(photo));
    }
  }

  const canEdit = ready && !busy && Boolean(photo);
  return (
    <main className="editor-page">
      <header>
        {/* Plain links, as on SkyData's other pages: next/link's client navigation fails under vinext here
            ("e is not a function"), and a full page load also shuts the editing engine down. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">skydata<span>✦</span></a>
        <a href="/files" className="invite-inbox-link editor-files-link"><FolderOpen size={16} />My Files</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="new"><ArrowLeft size={18} />Back to chat</a>
      </header>
      <section className="editor-surface" aria-live="polite">
        <h1>Editor</h1>
        <div className="editor-log">
          {messages.map((m) => (
            <div key={m.id} className={`editor-msg ${m.who}`}>
              <p>{m.text}</p>
              {m.image && <img src={m.image} alt={m.who === 'me' ? 'Your photo' : 'Edited preview'} />}
              {m.meta && <span className="editor-meta">{m.meta}</span>}
              {m.actions && (
                <div className="editor-actions">
                  <button type="button" disabled={!canEdit} onClick={() => submit('undo')}><Undo2 size={16} />Undo</button>
                  <button type="button" disabled={!canEdit} onClick={() => download('jpg')}><Download size={16} />Download JPG</button>
                  <button type="button" disabled={!canEdit} onClick={() => download('png')}><Download size={16} />Download PNG</button>
                  <button type="button" disabled={!canEdit} onClick={() => saveToFiles()}><Save size={16} />Save to My Files</button>
                </div>
              )}
              {m.filesLink && (
                <div className="editor-actions">
                  <a href="/files"><FolderOpen size={16} />Open My Files</a>
                </div>
              )}
            </div>
          ))}
          <div ref={logEnd} />
        </div>
      </section>
      <form
        className="editor-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const t = input;
          setInput('');
          void submit(t);
        }}
      >
        <div className="editor-chips">
          {CHIPS.map((c) => (
            <button key={c} type="button" disabled={!canEdit} onClick={() => submit(c)}>{c}</button>
          ))}
        </div>
        <div className="editor-line">
          <button type="button" className="editor-upload" aria-label="Upload a photo" disabled={!ready || busy} onClick={() => fileInput.current?.click()}><Camera size={20} /></button>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void openFile(f); }} />
          <input className="editor-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the edit…" enterKeyHint="send" disabled={!canEdit} aria-label="Describe the edit" />
          <button className="editor-send" disabled={!canEdit || !input.trim()}>Edit</button>
        </div>
        <div className="editor-status">{status}</div>
      </form>
    </main>
  );
}
