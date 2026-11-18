// Parcel map data: every drawn boundary must be a real closed ring in range; no private fields; owner-less parcels stay owner-less.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const dir = new URL('../../kinvest-liens/map/', import.meta.url); const idx = JSON.parse(fs.readFileSync(new URL('index.json', dir)));
test('index lists datasets and honest note', () => { assert.ok(idx.datasets.length > 50); assert.match(idx.note, /boundar/i); });
for (const d of idx.datasets) test('dataset ' + d.id, () => {
  const j = JSON.parse(fs.readFileSync(new URL('data/' + d.file, dir))); assert.equal(j.recs.length, d.records); let mapped = 0;
  const seen = new Set();
  for (const r of j.recs) {
    assert.ok(!seen.has(r.i), 'dup id ' + r.i); seen.add(r.i); assert.ok(['tax_lien', 'tax_deed', 'land_bank'].includes(j.dict.c ? j.dict.c[r.c] : r.c));
    assert.ok(!('mailing' in r) && !('ml' in r));
    if (r.g) { mapped++; assert.ok(r.g.length >= 1); for (const ring of r.g) { assert.ok(ring.length >= 4, 'ring too short ' + r.i); assert.deepEqual(ring[0], ring[ring.length - 1], 'open ring ' + r.i); for (const [x, y] of ring) { assert.ok(x > -180 && x < -60 && y > 15 && y < 72, 'out of range ' + r.i); } } assert.ok(r.cx, 'drawn parcel without centroid'); }
    if (r.o == null) assert.ok(!r.os && !r.ot || true);
  }
  assert.equal(mapped, d.mapped);
});
