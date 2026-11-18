// Builds the data behind /map/ from records the site ALREADY holds (nothing is invented or fetched):
//   county sale lists (liens-*.js), verified parcel outlines + roll facts (parcels/*.json), Alabama state-held land (al-state-land-data.js),
//   Arkansas COSL listing (ar-cosl-data.js), HOA status files, state rules (states.js).
// One JSON file per county in kinvest-liens/map/data/, plus map/index.json (what exists, counts, boundary coverage, dates).
// A parcel gets a polygon ONLY from an exact parcel-ID match in those verified outline files. Otherwise it is "list only" (no map shape).
// Mailing addresses are never copied. Run: node tools/map/build.mjs
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const DS = require('../../kinvest-liens/liens/states/data-status.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), ST = path.join(ROOT, 'kinvest-liens/liens/states'), OUT = path.join(ROOT, 'kinvest-liens/map');
const TODAY = process.env.MAP_TODAY || new Date().toISOString().slice(0, 10);
const run = (file, tail) => { const ctx = { LIENS: [] }; vm.runInNewContext('var LIENS=[];\n' + fs.readFileSync(path.join(ST, file), 'utf8') + '\n;' + tail, ctx, { timeout: 8000 }); return ctx; };
const slug = c => String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const NAMES = vm.runInNewContext(fs.readFileSync(path.join(ST, 'states.js'), 'utf8') + ';STATES', {});
const stByA = Object.fromEntries(NAMES.map(s => [s.a, s]));
const LAND = vm.runInNewContext('(' + fs.readFileSync(path.join(ST, 'lien-ui.js'), 'utf8').match(/const LAND_OUTLINES = (\{[^;]*\});/)[1] + ')', {});
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const OWNER_ENTITY = /\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|LLP|LTD|TRUST|TR|ESTATE|ASSOC|ASSOCIATION|BANK|CHURCH|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|INVESTMENTS?|REALTY|DEVELOPMENT|ENTERPRISES?|FOUNDATION|CITY OF|COUNTY OF|STATE OF|UNITED STATES|HOA|HOMEOWNERS)\b/i;
const ownerType = o => !o ? null : /\b(CITY OF|COUNTY OF|STATE OF|UNITED STATES|COUNTY|DISTRICT|AUTHORITY)\b/i.test(o) ? 'Government' : /\bTRUST|ESTATE\b/i.test(o) ? 'Trust or estate' : OWNER_ENTITY.test(o) ? 'Business or entity' : 'Individual(s)';
const XC = readJson(path.join(ROOT, 'tools/crosscheck/owners.json')) || {};
const tidy = s => String(s || '').replace(/\s+/g, ' ').trim();
const normOwner = s => tidy(s).toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\b(LLC|INC|CORP|CO)\b/g, '').trim();

// Douglas-Peucker on [lon,lat] rings (tolerance in degrees; 0.000008 is about 0.9 m)
function dp(pts, tol) { if (pts.length < 5) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let mx = 0, ix = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) { const [x, y] = pts[i]; let d; if (!L) d = Math.hypot(x - x1, y - y1); else { const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)); d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); } if (d > mx) { mx = d; ix = i; } }
    if (mx > tol && ix > 0) { keep[ix] = 1; st.push([a, ix], [ix, b]); } }
  return pts.filter((_, i) => keep[i]); }
const simplify = (rings, bb) => { const tol = bb ? Math.max(0.000003, Math.min(0.000012, 0.012 * Math.max(bb[2] - bb[0], bb[3] - bb[1]))) : 0.000012; return rings.map(r => { const s = dp(r, tol).map(p => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]); return s.length >= 4 ? s : null; }).filter(Boolean); };
const centroid = bb => [Math.round((bb[0] + bb[2]) / 2 * 1e5) / 1e5, Math.round((bb[1] + bb[3]) / 2 * 1e5) / 1e5];

const catFromSystem = a => { const s = stByA[a]; return s && /deed/i.test(s.sys) && !/lien certificate/i.test(s.sys) ? 'tax_deed' : 'tax_lien'; };
function category(key, state) { if (key === 'deed-sale') return 'tax_deed'; if (['tax-lien', 'otc', 'county-held'].includes(key)) return 'tax_lien'; if (key === 'state-held') return 'land_bank'; return catFromSystem(state); }
const LIVE = new Set(['tax-lien', 'otc', 'deed-sale', 'county-held', 'state-held']);
const flood = fl => { if (!fl || fl.s !== 'ok' || !Array.isArray(fl.z) || !fl.z.length) return null; const z = [...fl.z].sort((a, b) => b[1] - a[1]); return { z: z.map(x => x[0] + ' ' + Math.round(x[1]) + '%').join(', '), sfha: fl.sfha != null ? Math.round(fl.sfha) : null }; };
const num = v => v == null || v === '' || !isFinite(Number(v)) ? null : Number(v);

function recFrom(l, state, outlines, hoa, lookup) {
  const r = outlines && outlines.p && outlines.p[lookup || l.parcel] || null, d = DS.describe(l, { today: TODAY }), key = d.status.key;
  const matched = !!(r && r.st === 'matched' && r.g && r.g.length), own = tidy(r && r.own || ''), listOwner = tidy(l.owner || '');
  const owner = own || listOwner || null, alt = own && listOwner && normOwner(own) !== normOwner(listOwner) ? listOwner : null;
  const useTxt = tidy((r && r.use) || l.use || ''), vac = /vacant/i.test(useTxt) ? 1 : 0, h = hoa && hoa.p && hoa.p[l.parcel];
  const rec = { i: state + '|' + l.county + '|' + l.parcel + '|' + (l.cert || ''), p: l.parcel, c: category(key, state), k: key, v: LIVE.has(key) && d.freshness.key !== 'outdated' ? 1 : 0, sl: key === 'county-held' ? 'Certificate originally sold' : ['tax-lien', 'otc', 'deed-sale', 'historical', 'sold'].includes(key) ? 'Sale date' : null,
    t: d.status.label, fr: d.freshness.label, w: d.warnings.slice(0, 3), o: owner, os: own ? 'County parcel and tax roll record' : listOwner ? 'County sale list' : null, oa: alt, ot: ownerType(owner),
    a: tidy(l.address || (r && r.addr) || ''), ac: num(r && r.ac) != null ? r.ac : num(l.acres), sf: num(r && r.sqft), us: useTxt || null, va: vac, av: num(r && (r.av != null ? r.av : r.jv)) ?? num(l.assessed) ?? num(l.market), mv: num(l.market), amt: num(l.amount), al: l.priceLabel || (category(key, state) === 'tax_deed' ? 'Price or minimum bid on the list' : 'Amount on the list'), rt: tidy(l.rate) || null, sd: tidy(l.saleDate) || null, ty: l.taxYear || null, ct: l.cert || null, st: tidy(l.status) || null,
    src: tidy(l.source) || null, su: /^https?:/.test(String(l.source)) ? l.source : null, ck: l.checked || null, fz: flood(r && r.fl), wt: r && r.wt && r.wt.s === 'ok' && r.wt.pct != null ? Math.round(r.wt.pct * 10) / 10 : null, zn: r && r.zn && r.zn.s === 'ok' ? r.zn.v : null, hoa: h && h.st ? h.st : null, why: !matched ? (r && r.kind === 'condo' ? 'Condo unit: units are not mapped separately' : r && r.kind === 'mineral' ? 'Mineral or subsurface rights: no surface lot' : 'No verified boundary match') : null };
  if (matched) { rec.g = simplify(r.g, r.bb); rec.bb = r.bb; rec.cx = centroid(r.bb); if (!rec.g.length) { delete rec.g; rec.why = 'Boundary too small to draw'; } }
  for (const k of Object.keys(rec)) { const v = rec[k]; if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || v === 0 && ['va', 'sf'].includes(k)) delete rec[k]; }
  return rec;
}
const FL_PA_ = (() => { try { return vm.runInNewContext(fs.readFileSync(path.join(ST, 'parcel-links.js'), 'utf8') + ';({FL_PA, PARCEL_LOOKUP})', {}); } catch (e) { return { FL_PA: {}, PARCEL_LOOKUP: {} }; } })();
const DETAIL = (() => { try { return Object.keys(vm.runInNewContext('(' + fs.readFileSync(path.join(ROOT, 'kinvest-liens/liens/parcel/parcel.js'), 'utf8').match(/const FILES = (\{[^;]*\});/)[1] + ')', {})); } catch (e) { return []; } })();
const REPORT = (() => { try { return Object.keys(vm.runInNewContext('(' + fs.readFileSync(path.join(ROOT, 'netlify/functions/screen.mjs'), 'utf8').match(/const FILES = (\{[^;]*\});/)[1] + ')', {})); } catch (e) { return []; } })();
const gisFor = (state, county) => { const c = String(county).replace(/ County$/, ''); if (state === 'FL' && FL_PA_.FL_PA[c]) return { name: c + ' County Property Appraiser', url: FL_PA_.FL_PA[c] }; const a = (FL_PA_.PARCEL_LOOKUP[state] || [])[0]; return a ? { name: a[0], url: a[1] } : null; };
const datasets = []; const index = []; fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
function emit(id, state, county, recs0, meta) {
  const seenI = new Set(), recs = recs0.filter(r => !seenI.has(r.i) && seenI.add(r.i)); // a repeated row for the same parcel and certificate is listed once
  const mapped = recs.filter(r => r.g).length, cats = {}; recs.forEach(r => { cats[r.c] = (cats[r.c] || 0) + 1; });
  const vac = recs.filter(r => r.va).length, bbs = recs.filter(r => r.bb).map(r => r.bb);
  const bb = bbs.length ? [Math.min(...bbs.map(b => b[0])), Math.min(...bbs.map(b => b[1])), Math.max(...bbs.map(b => b[2])), Math.max(...bbs.map(b => b[3]))] : null;
  // repeated strings are stored once in `dict` and referenced by number (the page expands them when it loads the file)
  const DICT = ['sl', 't', 'fr', 'src', 'su', 'al', 'st', 'os', 'ot', 'rt', 'sd', 'ck', 'us', 'zn', 'hoa', 'why', 'k', 'w'], dict = Object.fromEntries(DICT.map(k => [k, []])), enc = recs.map(r => { const o = { ...r }; for (const k of DICT) if (o[k] != null) { const v = JSON.stringify(o[k]); let i = dict[k].indexOf(v); if (i < 0) { i = dict[k].length; dict[k].push(v); } o[k] = i; } return o; });
  for (const k of DICT) dict[k] = dict[k].map(x => JSON.parse(x));
  const file = id + '.json'; fs.writeFileSync(path.join(OUT, 'data', file), JSON.stringify({ id, state, county, built: TODAY, ...meta, dict, recs: enc }));
  index.push({ id, state, county, ik: recs[0] ? recs[0].i.split('|').slice(0, 2).join('|') : null, file, detail: meta.kind === 'county-list' && DETAIL.includes(county), report: meta.kind === 'county-list' && REPORT.includes(county), gis: gisFor(state, county), records: recs.length, mapped, cats, vacant: vac, bb, updated: meta.updated || null, sources: meta.sources, kb: Math.round(fs.statSync(path.join(OUT, 'data', file)).size / 1024) });
}
// 1) county sale lists
for (const f of fs.readdirSync(ST).filter(x => /^liens-.*\.js$/.test(x) && x !== 'liens-data.js')) {
  const L = run(f, 'this.LIENS=LIENS').LIENS; if (!L.length) continue; const county = L[0].county, state = L[0].state || 'FL';
  const lo = LAND[county]; const file = state === 'FL' ? slug(county) + '.json' : lo && lo.file;
  const outlines = file && readJson(path.join(ST, 'parcels', file)), hoa = state === 'FL' ? readJson(path.join(ST, 'hoa', slug(county) + '.json')) : null;
  const recs = L.map(l => recFrom(l, state, outlines, hoa)); const XD = (XC.differ || {})[state + '-' + county]; // county GIS owner differs from the sale list: show the GIS owner, note the list name
  if (XD) recs.forEach((r, n) => { const g = XD[L[n].parcel]; if (g) { r.oa = r.o; r.o = g; r.os = 'County GIS parcel record'; r.ot = ownerType(g); } });
  const checked = recs.map(r => r.ck).filter(Boolean).sort();
  emit(state + '-' + slug(county), state, county, recs, { kind: 'county-list', updated: checked.length ? checked[checked.length - 1] : null, sources: [...new Set(recs.map(r => r.su).filter(Boolean))].slice(0, 3), outlineSource: outlines ? (outlines.source || outlines.sources || (lo && lo.src) || 'county GIS') : null });
}
// 2) Alabama state-held land (ADOR transcripts), outlines where an exact-ID outline file exists
{ const A = run('al-state-land-data.js', 'this.A=AL_STATE_LAND').A || [];
  for (const t of A) { const o = readJson(path.join(ST, 'parcels', 'al-' + t.co + '.json')); if (!o) continue; // only counties with verified outlines become map datasets
    const recs = t.rows.map(([owner, year, cert, cls, pid, desc, amt]) => { const l = { county: t.county, parcel: pid, owner, taxYear: year, cert, desc, amount: amt, priceLabel: 'Amount bid at the tax sale', status: 'State-held land: tax delinquent land available for sale (ADOR transcript)', source: t.source, checked: t.date, saleDate: '', rate: '' }; const x = recFrom(l, 'AL', o, null); x.c = 'land_bank'; x.k = 'state-held'; x.t = DS.CLASSES['state-held'][0]; x.v = 1; return x; });
    emit('AL-' + t.co, 'AL', t.county, recs, { kind: 'state-held-land', updated: t.date, sources: [t.source], outlineSource: o.source || o.sources || 'Alabama county GIS' }); } }
// 3) Arkansas COSL (statewide parcels file, grouped by county)
{ const R = run('ar-cosl-data.js', 'this.R=AR_COSL').R || [], o = readJson(path.join(ST, 'parcels', 'ar.json')); const by = {};
  for (const [county, parcel, owner, ac, str, start, cur, added] of R) (by[county] = by[county] || []).push({ county, parcel, owner, acres: ac, desc: str, amount: start, priceLabel: cur ? 'Starting bid (current bid ' + cur + ')' : 'Starting bid', status: 'State-held land: Commissioner of State Lands auction listing', source: 'https://www.cosl.org/', checked: added, saleDate: '', rate: '' });
  for (const [county, rows] of Object.entries(by)) { const recs = rows.map(l => { const x = recFrom(l, 'AR', o, null, l.county + '|' + l.parcel); x.c = 'land_bank'; x.k = 'state-held'; x.t = DS.CLASSES['state-held'][0]; x.v = 1; return x; }); emit('AR-' + slug(county), 'AR', county + ' County', recs, { kind: 'state-held-land', updated: recs.map(r => r.ck).sort().pop(), sources: ['https://www.cosl.org/'], outlineSource: (o && (o.source || o.sources)) || 'Arkansas statewide parcels' }); } }
// 4) Mississippi state-held (tax-forfeited) land, Secretary of State list. Owner names/addresses in that file are not copied; the outline, owner of record, address and acres
//    come from the MARIS statewide parcel layers ONLY where the parcel number matched exactly (tools/ms-parcels/match.py). Everything else is listed, not drawn.
{ const R = run('ms-forfeited-data.js', 'this.R=MS_TFL').R || [], o = readJson(path.join(ST, 'parcels', 'ms.json')); const by = {};
  for (const [county, parcel, mv] of R) (by[county] = by[county] || []).push({ county, parcel, market: mv || null, amount: null, desc: 'Mississippi tax-forfeited land, ' + county + ' County', status: 'State-held land: tax-forfeited land listed by the Mississippi Secretary of State', source: 'https://www.sos.ms.gov/public-lands/tax-forfeited-lands', checked: '2026-11-10', saleDate: '', rate: '' });
  for (const [county, rows] of Object.entries(by)) { const recs = rows.map(l => { const x = recFrom(l, 'MS', o, null, l.county + '|' + l.parcel); x.c = 'land_bank'; x.k = 'state-held'; x.t = DS.CLASSES['state-held'][0]; x.v = 1; x.al = 'County market value'; return x; }); emit('MS-' + slug(county), 'MS', county + ' County', recs, { kind: 'state-held-land', updated: '2026-11-10', sources: ['https://www.sos.ms.gov/public-lands/tax-forfeited-lands'], outlineSource: o && o.source || null }); } }
index.sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));
const usedStates = Object.fromEntries([...new Set(index.map(d => d.state))].map(a => [a, { n: stByA[a].n, sys: stByA[a].sys, rate: stByA[a].rate, red: stByA[a].red, bid: stByA[a].bid, verify: !!stByA[a].v }]));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ built: TODAY, states: usedStates, allStates: NAMES.map(s => ({ a: s.a, n: s.n })), note: 'Boundaries come only from exact parcel-ID matches in verified county or state GIS files. Counties not listed here have no data on this map yet.', datasets: index }));
const tot = index.reduce((a, d) => ({ r: a.r + d.records, m: a.m + d.mapped, kb: a.kb + d.kb }), { r: 0, m: 0, kb: 0 }); console.log(index.length, 'datasets |', tot.r, 'records |', tot.m, 'with verified boundaries |', tot.kb, 'KB'); console.table(index.map(d => ({ id: d.id, rec: d.records, mapped: d.mapped, vac: d.vacant, kb: d.kb, cats: JSON.stringify(d.cats) })));
