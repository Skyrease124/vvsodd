'use client';
// My Files (Creative Files): photos saved from the Editor, stored in this browser on this device (lib/creative-files.ts).
// Nothing here is uploaded; open a file to keep editing it, download or share it, or delete it.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Download, Pencil, Share2, Trash2, Wand2 } from 'lucide-react';
import { deleteFile, fileSize, listFiles, readFile, storageUse, type CreativeFile } from '../../lib/creative-files';
import '../editor/editor.css';
import './files.css';

// Phones that can share files (iPhone: "Save Image" puts it in Photos). False while rendering on the server.
const shareCheck = () => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.jpg', { type: 'image/jpeg' })] });
const noSubscribe = () => () => {};
const date = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function Files() {
  const [files, setFiles] = useState<CreativeFile[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [usage, setUsage] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [busy, setBusy] = useState('');
  const canShare = useSyncExternalStore(noSubscribe, shareCheck, () => false);
  const urls = useRef<string[]>([]);

  const show = async (list: CreativeFile[]) => {
    for (const u of urls.current.splice(0)) URL.revokeObjectURL(u);
    const t: Record<string, string> = {};
    for (const f of list) {
      t[f.id] = URL.createObjectURL(f.thumb);
      urls.current.push(t[f.id]);
    }
    setThumbs(t);
    setFiles(list);
    setUsage(await storageUse().catch(() => null));
  };
  const load = () =>
    listFiles()
      .then(show)
      .catch((e: Error) => {
        setError(e.message);
        setFiles([]);
      });

  useEffect(() => {
    void load();
    const created = urls.current;
    return () => {
      for (const u of created) URL.revokeObjectURL(u);
    };
  }, []);

  async function image(f: CreativeFile) {
    const saved = await readFile(f.id);
    if (!saved) throw new Error('That file is no longer on this device.');
    return new File([saved.data.image], `${f.name}-edited.jpg`, { type: 'image/jpeg' });
  }

  async function download(f: CreativeFile) {
    setBusy(f.id);
    setError('');
    try {
      const file = await image(f);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNote(`Downloaded ${file.name}.`);
    } catch (e) {
      setError('Download failed: ' + (e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function share(f: CreativeFile) {
    setBusy(f.id);
    setError('');
    try {
      await navigator.share({ files: [await image(f)], title: f.name });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Sharing failed: ' + (e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function remove(f: CreativeFile) {
    if (!confirm(`Delete "${f.name}" from My Files? This can't be undone.`)) return;
    setBusy(f.id);
    setError('');
    try {
      await deleteFile(f.id);
      setNote(`Deleted "${f.name}".`);
      await load();
    } catch (e) {
      setError('Delete failed: ' + (e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="editor-page files-page">
      <header>
        {/* Plain links, as on the Editor: next/link's client navigation fails under vinext here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/">skydata<span>✦</span></a>
        <a href="/editor" className="invite-inbox-link editor-files-link"><Wand2 size={16} />Editor</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="new"><ArrowLeft size={18} />Back to chat</a>
      </header>
      <section className="editor-surface files-surface">
        <h1>My Files</h1>
        <p className="files-note">
          Photos you save from the Editor. They are stored only in this browser on this device, never uploaded. Safari can clear a website&apos;s files after about 7 days without a visit, unless SkyData is added to your Home Screen, so download anything important.
        </p>
        {usage && (
          <p className="files-usage">
            Using {fileSize(usage.used)}{usage.quota ? ` of about ${fileSize(usage.quota)} available` : ''} on this device{usage.persisted ? ' · protected from automatic clearing' : ''}.
          </p>
        )}
        {error && <p className="editor-msg err files-alert" role="alert">{error}</p>}
        {note && !error && <p className="files-status" role="status">{note}</p>}
        {files === null && <p className="files-status">Loading…</p>}
        {files?.length === 0 && !error && (
          <div className="files-empty">
            <p>No saved files yet. Open the Editor, edit a photo and tap <b>Save to My Files</b>.</p>
            <a href="/editor"><Wand2 size={16} />Open the Editor</a>
          </div>
        )}
        {files && files.length > 0 && (
          <ul className="files-grid">
            {files.map((f) => (
              <li key={f.id} className="files-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbs[f.id]} alt={f.name} />
                <div className="files-info">
                  <strong>{f.name}</strong>
                  <span>{date(f.updated)}</span>
                  <span>{f.width}×{f.height} px · {fileSize(f.size)} · {f.edits === 1 ? '1 edit' : `${f.edits} edits`}</span>
                </div>
                <div className="editor-actions">
                  <a href={`/editor?file=${encodeURIComponent(f.id)}`}><Pencil size={16} />Edit</a>
                  <button type="button" disabled={Boolean(busy)} onClick={() => download(f)}><Download size={16} />Download</button>
                  {canShare && <button type="button" disabled={Boolean(busy)} onClick={() => share(f)}><Share2 size={16} />Share / Save to Photos</button>}
                  <button type="button" className="files-delete" disabled={Boolean(busy)} onClick={() => remove(f)} aria-label={`Delete ${f.name}`}><Trash2 size={16} />Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
