// Static map data baseline. Records a sha256 for every published map data file, so a change to the static
// datasets is visible in review and fails CI until the manifest is regenerated on purpose.
//   node tools/map/static-baseline.mjs          rewrite netlify/lib/data/static-map-baseline.json
// This is a CI gate only. It does not change what the site serves.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MANIFEST = path.join(ROOT, 'netlify', 'lib', 'data', 'static-map-baseline.json');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

// Lists every published map data file and the map index, in a stable order, with no timestamps.
export function hashStaticMapData(root = ROOT) {
  const dir = path.join(root, 'kinvest-liens', 'map', 'data');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const entries = files.map(f => ({path: 'kinvest-liens/map/data/' + f, sha256: sha(fs.readFileSync(path.join(dir, f)))}));
  entries.push({path: 'kinvest-liens/map/index.json', sha256: sha(fs.readFileSync(path.join(root, 'kinvest-liens', 'map', 'index.json')))});
  return {schemaVersion: 1, count: entries.length, files: entries};
}

// Compares a current hash list with a stored manifest. Returns the paths that were added, removed or changed.
export function diffManifest(current, manifest) {
  const want = new Map((manifest.files || []).map(f => [f.path, f.sha256]));
  const have = new Map(current.files.map(f => [f.path, f.sha256]));
  const changed = [], added = [], removed = [];
  for (const [p, h] of have) {
    if (!want.has(p)) added.push(p);
    else if (want.get(p) !== h) changed.push(p);
  }
  for (const p of want.keys()) if (!have.has(p)) removed.push(p);
  return {changed, added, removed, clean: !changed.length && !added.length && !removed.length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = hashStaticMapData();
  fs.mkdirSync(path.dirname(MANIFEST), {recursive: true});
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Wrote ' + manifest.count + ' hashes to ' + path.relative(ROOT, MANIFEST));
}
