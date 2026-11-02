// Where the NVIDIA key lives. Order: Netlify environment variable, then the key saved from the /admin/ setup page.
// Saved keys are stored server-side in Netlify Blobs and are never sent to a browser.
const fs = require('fs');

let cache = null, cacheAt = 0;

function store(event) {
  const { connectLambda, getStore } = require('@netlify/blobs');
  if (event && event.blobs) connectLambda(event);
  return getStore({ name: 'pricepocketasset-config', consistency: 'strong' });
}

// File-backed mode is used only by local tests (KEYSTORE_FILE).
async function read(event) {
  if (process.env.KEYSTORE_FILE) { try { return JSON.parse(fs.readFileSync(process.env.KEYSTORE_FILE, 'utf8')); } catch (e) { return null; } }
  try { return await store(event).get('nvidia', { type: 'json' }); } catch (e) { return null; }
}
async function write(event, value) {
  if (process.env.KEYSTORE_FILE) { fs.writeFileSync(process.env.KEYSTORE_FILE, JSON.stringify(value)); return; }
  await store(event).setJSON('nvidia', value);
}
async function erase(event) {
  if (process.env.KEYSTORE_FILE) { try { fs.unlinkSync(process.env.KEYSTORE_FILE); } catch (e) {} return; }
  await store(event).delete('nvidia');
}

// Returns {key, model, source} or null.
async function getConfig(event) {
  if (process.env.NVIDIA_API_KEY) return { key: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL || '', source: 'env' };
  const now = Date.now();
  if (cache !== undefined && cache !== null && now - cacheAt < 30000) return cache;
  const v = await read(event);
  cache = v && v.key ? { key: v.key, model: v.model || '', source: 'saved', savedAt: v.savedAt } : null; cacheAt = now;
  return cache;
}
function clearCache() { cache = null; cacheAt = 0; }

module.exports = { getConfig, write, erase, clearCache };
