'use client';
// SkyData Editor: upload a photo, describe the edit, preview, undo and download. Everything runs in the browser
// (PhotoCraft's engine as WebAssembly in a Web Worker, public/editor-engine/); photos are never uploaded.
// The engine starts when this page opens and is shut down when it closes, so it holds no memory elsewhere.
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Download, Undo2 } from 'lucide-react';
import { planWithRules, type EditStep } from '../../lib/editor-planner';
import './editor.css';

type Info = { width: number; height: number };
type EngineState = { info: Info; steps: number; scale: number; full: Info; preview?: Blob };
type Msg = { id: number; who: 'me' | 'sky' | 'err'; text: string; image?: string; meta?: string; actions?: boolean };
type Photo = { name: string; width: number; height: number; steps: number; scale: number; full: Info };

// The browser's own decoder is the fallback for files the engine cannot open (HEIC on iPhone), limited to the
// canvas area iOS Safari allows.
const CANVAS_MAX_PIXELS = 16_000_000;
const CHIPS = ['auto enhance', 'brighter', 'more contrast', 'black and white', 'warmer', 'vibrant', 'sharpen', 'square crop', 'rotate right', 'blur 4'];

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
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, who: 'sky', text: 'Upload a photo, then tell me how to edit it: "brighter and more contrast", "black and white", "square crop" or "warmer and sharpen". Everything happens on your device; your photo is not uploaded.' }]);
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

  async function openFile(file: File) {
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
      setPhoto(p);
      add({ who: 'me', text: label, image: imageUrl(res.preview!), meta: `${res.full.width}×${res.full.height} px${note}` });
      add({ who: 'sky', text: 'Got it. What would you like to change?' });
      setStatus(describe(p));
    } catch (e) {
      add({ who: 'me', text: label });
      add({ who: 'err', text: 'Could not open this photo: ' + (e as Error).message });
      setStatus(photo ? describe(photo) : 'Ready. Upload a photo to start.');
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
    const plan = isUndo ? { undo: true as const } : planWithRules(text, photo);
    if (!isUndo) add({ who: 'me', text });
    if (!plan.undo && plan.steps.length === 0) {
      add({ who: 'sky', text: plan.reply });
      return;
    }
    setBusy(true);
    setStatus(plan.undo ? 'Undoing…' : 'Editing…');
    try {
      const res = plan.undo ? await call('undo') : await call('run', { steps: plan.steps as EditStep[] });
      const p = { ...photo, width: res.info.width, height: res.info.height, steps: res.steps, scale: res.scale, full: res.full };
      setPhoto(p);
      add({ who: 'sky', text: plan.undo ? 'Undid the last edit.' : plan.reply, image: imageUrl(res.preview!), meta: `${res.info.width}×${res.info.height} px · ${res.ms} ms`, actions: true });
      setStatus(describe(p));
    } catch (e) {
      add({ who: 'err', text: (e as Error).message });
      setStatus(describe(photo));
    } finally {
      setBusy(false);
    }
  }

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
      add({ who: 'sky', text: `Saved ${a.download}: ${width}×${height} px, ${(blob.size / 1048576).toFixed(1)} MB, rendered in ${(ms / 1000).toFixed(1)} s.` });
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
