// Creative Files ("My Files"): edited photos saved in this browser on this device (IndexedDB), never uploaded.
// Each SkyData account gets its own database (named from a hash of the account email), so two people signing in
// on the same browser don't see each other's files. Listing reads only small records and thumbnails; the
// original photo, its edit steps and the full-size result are in a separate store, read when a file is opened.
import type { EditStep } from './editor-planner';

export type CreativeFile = { id: string; name: string; created: number; updated: number; width: number; height: number; size: number; edits: number; thumb: Blob };
export type CreativeFileData = { id: string; originalName: string; original: Blob; plans: EditStep[][]; image: Blob };

const VERSION = 2; // 2: adds the chat → Editor hand-off store
let opened: Promise<IDBDatabase> | null = null;

async function accountKey() {
  const r = await fetch('/api/auth/session', { cache: 'no-store' });
  const s = (await r.json().catch(() => ({}))) as { email?: string };
  if (!r.ok || !s.email) throw new Error('Sign in to use My Files.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.email.trim().toLowerCase()));
  return [...new Uint8Array(hash).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function db() {
  opened ??= accountKey()
    .then(
      (key) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot store files.'));
          const req = indexedDB.open('skydata-creative-files-' + key, VERSION);
          req.onupgradeneeded = () => {
            for (const name of ['items', 'data', 'handoff']) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error ?? new Error('My Files could not be opened.'));
          req.onblocked = () => reject(new Error('Close other SkyData tabs and try again.'));
        }),
    )
    .catch((e) => {
      opened = null;
      throw e;
    });
  return opened;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(storageError(tx.error));
    tx.onabort = () => reject(storageError(tx.error));
  });
const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(storageError(req.error));
  });

function storageError(e: DOMException | null) {
  if (e?.name === 'QuotaExceededError') return new Error('This device has no more room for My Files. Delete or download some files first.');
  return new Error(e?.message || 'My Files could not be saved on this device.');
}

/** Newest first. */
export async function listFiles(): Promise<CreativeFile[]> {
  const tx = (await db()).transaction('items');
  const items = await result(tx.objectStore('items').getAll() as IDBRequest<CreativeFile[]>);
  return items.sort((a, b) => b.updated - a.updated);
}

export async function readFile(id: string): Promise<{ item: CreativeFile; data: CreativeFileData } | null> {
  const tx = (await db()).transaction(['items', 'data']);
  const [item, data] = await Promise.all([result(tx.objectStore('items').get(id) as IDBRequest<CreativeFile | undefined>), result(tx.objectStore('data').get(id) as IDBRequest<CreativeFileData | undefined>)]);
  return item && data ? { item, data } : null;
}

/** Saves a new file, or a new version of `id` when given (keeping its name and creation date). */
export async function saveFile(input: { id?: string; name: string; width: number; height: number; thumb: Blob; originalName: string; original: Blob; plans: EditStep[][]; image: Blob }): Promise<CreativeFile> {
  const d = await db();
  const now = Date.now();
  const existing = input.id ? await result(d.transaction('items').objectStore('items').get(input.id) as IDBRequest<CreativeFile | undefined>) : undefined;
  const id = existing?.id ?? crypto.randomUUID();
  const item: CreativeFile = { id, name: existing?.name ?? input.name, created: existing?.created ?? now, updated: now, width: input.width, height: input.height, size: input.image.size, edits: input.plans.length, thumb: input.thumb };
  const tx = d.transaction(['items', 'data'], 'readwrite');
  tx.objectStore('items').put(item);
  tx.objectStore('data').put({ id, originalName: input.originalName, original: input.original, plans: input.plans, image: input.image } satisfies CreativeFileData);
  await done(tx);
  // Ask the browser not to clear these files on its own (Safari otherwise may after 7 days without a visit).
  navigator.storage?.persist?.().catch(() => {});
  return item;
}

export async function deleteFile(id: string) {
  const tx = (await db()).transaction(['items', 'data'], 'readwrite');
  tx.objectStore('items').delete(id);
  tx.objectStore('data').delete(id);
  await done(tx);
}

// "Edit in Editor" from the chat: the photo waits here (this account, this device) until the Editor picks it up.
export async function handOffToEditor(photo: Blob, name: string) {
  const tx = (await db()).transaction('handoff', 'readwrite');
  tx.objectStore('handoff').put({ id: 'pending', photo, name, at: Date.now() });
  await done(tx);
}

/** The photo handed over from the chat, removed as it is read; null if none (or older than 10 minutes). */
export async function takeHandOff(): Promise<{ photo: Blob; name: string } | null> {
  const tx = (await db()).transaction('handoff', 'readwrite');
  const store = tx.objectStore('handoff');
  const item = await result(store.get('pending') as IDBRequest<{ photo: Blob; name: string; at: number } | undefined>);
  store.delete('pending');
  await done(tx);
  return item && Date.now() - item.at < 600_000 ? { photo: item.photo, name: item.name } : null;
}

export async function storageUse(): Promise<{ used: number; quota: number; persisted: boolean } | null> {
  if (!navigator.storage?.estimate) return null;
  const [e, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(false)]);
  return { used: e.usage ?? 0, quota: e.quota ?? 0, persisted };
}

/** A small JPEG thumbnail (longest side `side` px) from any image blob. */
export async function makeThumb(image: Blob, side = 360): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const g = canvas.getContext('2d')!;
  // JPEG has no transparency: a see-through photo is shown on white.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail failed.'))), 'image/jpeg', 0.8));
  canvas.width = canvas.height = 0;
  return blob;
}

export const fileSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
