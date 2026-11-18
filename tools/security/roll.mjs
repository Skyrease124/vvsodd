import fs from 'node:fs'; import path from 'node:path';
const { ID, call, ROOT } = await import('./harness.mjs');
let bad = 0; const t = (n, ok, i) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); };
const Q = 'county=Palm%20Beach&parcel=74-43-44-04-24-000-0243';
for (const id of ['anon', 'free', 'expired', 'revoked']) { const r = await call('roll', { q: Q, cookie: ID[id] }); t('roll: ' + id + ' is refused', [401, 402, 403].includes(r.status), r.status); }
for (const id of ['pro', 'canceledActive', 'owner']) { const r = await call('roll', { q: Q, cookie: ID[id] }); let j = {}; try { j = JSON.parse(r.text); } catch (e) {} t('roll: ' + id + ' gets the private fields', r.status === 200 && j.found && /HANSEN ST/.test(j.roll.mail || ''), r.status + ' ' + (j.roll && j.roll.mail)); }
t('roll: unknown parcel returns nothing (no error leak)', JSON.parse((await call('roll', { q: 'county=Palm%20Beach&parcel=NOPE', cookie: ID.pro })).text).found === false);
t('roll: path tricks in county are harmless', JSON.parse((await call('roll', { q: 'county=..%2F..%2Fetc&parcel=x', cookie: ID.pro })).text).found === false);
// public files must contain none of the private fields
let leaks = 0, files = 0; const dir = ROOT + '/kinvest-liens/liens/states/parcels';
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) { files++; const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); for (const v of Object.values(d.p || {})) if (v && v.rl && ('mail' in v.rl || 'abs' in v.rl || 'fidu' in v.rl || 'sale' in v.rl)) leaks++; }
t('public parcel files contain no mailing address, absentee flag, fiduciary or last sale', leaks === 0, files + ' files, ' + leaks + ' leaks');
// nothing was lost: every private value exists in the private files, and public files still have the free fields
let privN = 0, pubOwn = 0; for (const f of fs.readdirSync(ROOT + '/netlify/private/roll')) privN += Object.keys(JSON.parse(fs.readFileSync(ROOT + '/netlify/private/roll/' + f, 'utf8')).p).length;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) for (const v of Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).p || {})) if (v && v.rl && v.rl.own) pubOwn++;
t('private files hold 2,162 parcels; public files still show owner of record', privN === 2162 && pubOwn > 2000, privN + ' private, ' + pubOwn + ' public with owner');
// the whole site (static files) must not contain the private values: search every public file for a sample of mailing addresses
const sample = ['917 HANSEN ST, WEST PALM BEACH FL 33405']; let found = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(json|js|html)$/.test(e.name) && fs.statSync(p).size < 6e6) { const s = fs.readFileSync(p, 'utf8'); if (sample.some(x => s.includes(x))) found.push(p.replace(ROOT, '')); } } }; walk(ROOT + '/kinvest-liens');
t('a known private mailing address appears in no public file', found.length === 0, found.join(', '));
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(0);
