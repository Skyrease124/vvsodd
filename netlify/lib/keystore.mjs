// Where the NVIDIA key lives. Order: Netlify environment variable, then the key saved from the /admin/ setup page.
// Saved keys are stored server-side in Netlify Blobs and are never sent to a browser.
import fs from 'node:fs';
import { getStore } from '@netlify/blobs';

let cache = null, cacheAt = 0;
const store = () => getStore({ name: 'pricepocketasset-config', consistency: 'strong' });

// File-backed mode is used only by local tests (KEYSTORE_FILE).
async function read() {
  if (process.env.KEYSTORE_FILE) { try { return JSON.parse(fs.readFileSync(process.env.KEYSTORE_FILE, 'utf8')); } catch (e) { return null; } }
  try { return await store().get('nvidia', { type: 'json' }); } catch (e) { return null; }
}
export async function write(value) {
  if (process.env.KEYSTORE_FILE) { fs.writeFileSync(process.env.KEYSTORE_FILE, JSON.stringify(value)); return; }
  await store().setJSON('nvidia', value);
}
export async function erase() {
  if (process.env.KEYSTORE_FILE) { try { fs.unlinkSync(process.env.KEYSTORE_FILE); } catch (e) {} return; }
  await store().delete('nvidia');
}
// Returns {key, model, source} or null.
export async function getConfig() {
  if (process.env.NVIDIA_API_KEY) return { key: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || '', source: 'env' };
  const now = Date.now();
  if (cache && now - cacheAt < 30000) return cache;
  const v = await read();
  cache = v && v.key ? { key: v.key, model: v.model || '', source: 'saved', savedAt: v.savedAt } : null; cacheAt = now;
  return cache;
}
export function clearCache() { cache = null; cacheAt = 0; }
