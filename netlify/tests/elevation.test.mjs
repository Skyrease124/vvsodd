// Estimated Ground Elevation: the sample point must lie inside every verified outline, and no outline = no point.
import fs from 'fs'; import assert from 'assert';
const root = new URL('../../kinvest-liens/liens/states/', import.meta.url).pathname;
const src = fs.readFileSync(root + 'lien-ui.js', 'utf8');
const E = new Function(src.slice(src.indexOf('const ElevationData'), src.indexOf('// Florida property records from the parcel backfill')) + ';return ElevationData;')();
const inside = (pt, rings) => { let c = false; rings.forEach(r => { for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > pt.lat) !== (b[1] > pt.lat) && pt.lng < (b[0] - a[0]) * (pt.lat - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } }); return c; };
let n = 0;
for (const f of fs.readdirSync(root + 'parcels').filter(f => f.endsWith('.json') && !f.startsWith('al-'))) {
  const p = JSON.parse(fs.readFileSync(root + 'parcels/' + f)).p || {};
  for (const k in p) { const r = p[k]; if (r.st === 'matched' && r.g) { const pt = E.point(r); assert(pt && inside(pt, r.g), f + ' ' + k); n++; } }
}
assert(n > 900, 'matched parcels checked: ' + n);
// L-shaped lot whose centroid is outside the shape
const L = {g: [[[0, 0], [0.001, 0], [0.001, 0.0001], [0.0001, 0.0001], [0.0001, 0.001], [0, 0.001], [0, 0]]]};
assert(inside(E.point(L), L.g));
assert.deepStrictEqual(await E.get({}, {st: 'none'}), {state: 'nooutline'});
assert.deepStrictEqual(await E.get({}, null), {state: 'nooutline'});
assert(E.apiUrl({lng: -82.1, lat: 28.2}).includes('x=-82.1&y=28.2&wkid=4326&units=Feet'));
console.log('elevation ok: ' + n + ' outlines');
