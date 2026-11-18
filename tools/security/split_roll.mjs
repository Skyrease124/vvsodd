// One-time (and repeatable) split: moves the Pro-only tax-roll fields out of the PUBLIC parcel files into netlify/private/roll/.
// Public files keep owner of record, address, values and use (shown free). Private: mailing address, absentee flag, fiduciary, last sale.
// Nothing is deleted: every moved value is written to the private file first, and the script refuses to continue if a count does not match.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PUB = path.join(ROOT, 'kinvest-liens/liens/states/parcels'), PRIV = path.join(ROOT, 'netlify/private/roll');
const FIELDS = ['mail', 'abs', 'fidu', 'sale']; fs.mkdirSync(PRIV, { recursive: true });
let files = 0, moved = 0;
for (const f of fs.readdirSync(PUB).filter(f => f.endsWith('.json'))) {
  const raw = fs.readFileSync(path.join(PUB, f), 'utf8'), d = JSON.parse(raw); if (!d.p) continue;
  const priv = {}; let n = 0;
  for (const [k, v] of Object.entries(d.p)) { if (!v || !v.rl) continue; const o = {}; for (const x of FIELDS) if (v.rl[x] !== undefined && v.rl[x] !== '' && v.rl[x] !== null) o[x] = v.rl[x]; if (Object.keys(o).length) { priv[k] = o; n++; } }
  if (!n) continue;
  fs.writeFileSync(path.join(PRIV, f), JSON.stringify({ county: d.county, note: 'Pro-only tax roll fields. Served only by netlify/functions/roll.mjs to paid members.', p: priv }));
  const back = JSON.parse(fs.readFileSync(path.join(PRIV, f), 'utf8')); if (Object.keys(back.p).length !== n) throw new Error('private write mismatch in ' + f);
  for (const v of Object.values(d.p)) if (v && v.rl) for (const x of FIELDS) delete v.rl[x];
  fs.writeFileSync(path.join(PUB, f), JSON.stringify(d)); files++; moved += n; console.log(f, n, 'parcels moved');
}
console.log('files changed:', files, 'parcels with private fields:', moved);
