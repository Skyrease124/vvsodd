// Loads every county data file exactly as the website does (read-only) and returns normalized records.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const STATES_DIR = path.join(ROOT, 'kinvest-liens/liens/states');
const read = f => fs.readFileSync(path.join(STATES_DIR, f), 'utf8');
export function loadLiens() {
  const files = fs.readdirSync(STATES_DIR).filter(f => /^liens-.+\.js$/.test(f) && f !== 'liens-data.js');
  const out = [];
  for (const f of files) {
    const ctx = { LIENS: [] }; vm.createContext(ctx);
    try { vm.runInContext(read(f), ctx, { timeout: 20000 }); } catch (e) { out.push({ _loadError: f + ': ' + e.message }); continue; }
    for (const r of ctx.LIENS) out.push(Object.assign({ _file: f }, r));
  }
  return out;
}
export function loadConst(file, name) { const ctx = {}; vm.createContext(ctx); vm.runInContext(read(file) + '\n;globalThis.__x=' + name, ctx, { timeout: 20000 }); return ctx.__x; }
export const loadJson = f => JSON.parse(fs.readFileSync(path.join(STATES_DIR, f), 'utf8'));
