// Shared helper for vm-based tests. The pure policy modules (approval rules, release policy,
// research release rules) are loaded from the real production source, so tests check the rules
// that ship. Every other import is handled by the calling test's own stub.
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../netlify/lib');
const PURE = ['brain-approvals.mjs', 'update-release.mjs', 'research-releases.mjs', 'gemini-limits.mjs'];
const loaded = new Map();
export async function pureModule(specifier, context) {
  const file = PURE.find(name => specifier === name || specifier.endsWith('/' + name));
  if (!file) return null;
  if (!loaded.has(file)) loaded.set(file, await import(pathToFileURL(path.join(LIB, file)).href));
  const namespace = loaded.get(file);
  const names = Object.keys(namespace);
  return new vm.SyntheticModule(names, function () { for (const name of names) this.setExport(name, namespace[name]); }, {context});
}
