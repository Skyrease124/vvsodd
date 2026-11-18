// Pro-only Florida tax roll fields (owner mailing address, absentee flag, fiduciary, last sale).
// They live in netlify/private/roll/<county>.json, which is NOT published on the website: only server code reads it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), cache = {};
export const slugOf = county => String(county || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function file(county) {
  const slug = slugOf(county); if (!slug) return null; const root = process.env.LAMBDA_TASK_ROOT || process.cwd();
  return [path.join(root, 'netlify/private/roll', slug + '.json'), path.join(HERE, '../private/roll', slug + '.json')].find(x => fs.existsSync(x)) || null;
}
export function load(county) {
  const slug = slugOf(county); if (cache[slug] !== undefined) return cache[slug];
  let m = null; try { const f = file(county); if (f) m = JSON.parse(fs.readFileSync(f, 'utf8')).p || {}; } catch (e) { m = null; }
  return (cache[slug] = m);
}
export const get = (county, parcel) => { const m = load(county); return (m && m[String(parcel)]) || null; };
