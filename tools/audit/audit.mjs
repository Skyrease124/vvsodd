// Parcel data audit (READ-ONLY: never edits or deletes a record).
//   node tools/audit/audit.mjs [--probe] [--today=YYYY-MM-DD]
// Writes: kinvest-liens/liens/states/data-registry.json (small, used by the website)
//         tools/audit/reports/audit-<date>.json and .md (the full report)
// "--probe" makes one polite request per official source page (honest user agent, 1 s apart, no block circumvention).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { ROOT, STATES_DIR, loadLiens, loadConst, loadJson } from './load.mjs';
const require = createRequire(import.meta.url);
const DS = require(path.join(STATES_DIR, 'data-status.js'));
const args = process.argv.slice(2), PROBE = args.includes('--probe');
const TODAY = (args.find(a => a.startsWith('--today=')) || '').slice(8) || new Date().toISOString().slice(0, 10);
const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shape = p => String(p).replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'A');
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => new Set(norm(s).split(' ').filter(t => t && !['AND', 'THE', 'OF', 'LLC', 'INC', 'ETAL', 'ET', 'AL', 'TR', 'TRUST', 'EST', 'C', 'O'].includes(t)));
const j = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// ---------- 1. load ----------
const recs = loadLiens().filter(r => !r._loadError).map((r, i) => Object.assign({ _i: i, _kind: 'lien', state: r.state || 'FL' }, r));
const importsCfg = j('tools/imports/counties.json'), taxCfg = j('tools/taxsales/counties.json').counties || [];
let health = {}; try { health = j('tools/taxsales/health.json').counties || {}; } catch (e) {}

// state-level datasets (different shapes; counted, checked and registered, but classified only as state-held land)
const stateSets = [];
try { const a = loadConst('al-state-land-data.js', 'AL_STATE_LAND'); stateSets.push({ state: 'AL', name: 'Alabama Department of Revenue: state-held tax delinquent land', records: a.reduce((n, c) => n + c.rows.length, 0), counties: a.length, checked: a.map(c => c.date).sort().pop(), source: a[0] && a[0].source, withAmount: a.reduce((n, c) => n + c.rows.filter(r => r[6] != null).length, 0) }); } catch (e) { stateSets.push({ state: 'AL', error: e.message }); }
try { const a = loadConst('ar-cosl-data.js', 'AR_COSL'); stateSets.push({ state: 'AR', name: 'Arkansas Commissioner of State Lands: tax-delinquent land auction listing', records: a.length, counties: new Set(a.map(r => r[0])).size, checked: a.map(r => r[7]).sort().pop(), source: 'https://www.cosl.org/' }); } catch (e) { stateSets.push({ state: 'AR', error: e.message }); }
try { const a = loadConst('ms-forfeited-data.js', 'MS_TFL'); stateSets.push({ state: 'MS', name: 'Mississippi Secretary of State: tax-forfeited lands', records: a.length, counties: new Set(a.map(r => r[0])).size, checked: '2026-11-10', source: 'https://www.sos.ms.gov/public-lands/tax-forfeited-lands', withValue: a.filter(r => r[2] > 0).length }); } catch (e) { stateSets.push({ state: 'MS', error: e.message }); }
try { const a = loadConst('nm-auctions-data.js', 'NM_AUCTIONS'); stateSets.push({ state: 'NM', name: 'New Mexico Taxation and Revenue: public auction notices', records: a.reduce((n, x) => n + x.items.length, 0), removed: a.reduce((n, x) => n + x.items.filter(i => i.removed).length, 0), counties: new Set(a.map(x => x.county)).size, checked: a.map(x => x.checked).sort().pop(), source: a[0] && a[0].source }); } catch (e) { stateSets.push({ state: 'NM', error: e.message }); }

// ---------- 2. per-record checks ----------
// Certificate numbers restart every year in some counties (e.g. Manatee), so the certificate year and tax year are part of the key.
const keyOf = r => [r.state, slug(r.county), norm(r.parcel), norm(r.cert), r.certYear || '', r.taxYear || '', r.amount == null ? '' : r.amount, norm(r.saleDate)].join('|');
const parcelKey = r => [r.state, slug(r.county), norm(r.parcel)].join('|');
const seen = new Map(), seenParcel = new Map();
recs.forEach(r => { const k = keyOf(r); (seen.get(k) || seen.set(k, []).get(k)).push(r); const pk = parcelKey(r); (seenParcel.get(pk) || seenParcel.set(pk, []).get(pk)).push(r); });
const dupGroups = [...seen.values()].filter(g => g.length > 1);
const multiCert = [...seenParcel.values()].filter(g => new Set(g.map(x => norm(x.cert) + '|' + (x.certYear || x.taxYear || ''))).size > 1);

// cross-verification against official GIS parcel files we already hold (parcels/*.json)
const gis = {};
for (const f of fs.readdirSync(path.join(STATES_DIR, 'parcels')).filter(f => f.endsWith('.json'))) {
  try { const d = loadJson('parcels/' + f); gis[f.replace('.json', '')] = d; } catch (e) {}
}
const gisFor = r => gis[r.state === 'FL' ? slug(r.county) : r.state.toLowerCase() + '-' + slug(r.county)] || null;

const shapes = {};
recs.forEach(r => { const k = r.state + '|' + r.county; (shapes[k] = shapes[k] || {})[shape(r.parcel)] = ((shapes[k] || {})[shape(r.parcel)] || 0) + 1; });

const counters = { total: recs.length, fresh: { current: 0, aging: 0, outdated: 0, unknown: 0 }, status: {}, noSource: 0, missing: {}, invalid: [], gisMatched: 0, gisChecked: 0, gisNoFile: 0, gisUnmatched: 0, ownerAgree: 0, ownerCompared: 0, ownerDiffer: [], acresAgree: 0, acresCompared: 0, acresDiffer: [], verified: 0, rollMatched: 0 };
const perCounty = {};
const FIELDS = [['owner', 'owner name'], ['address', 'property address'], ['acres', 'acreage'], ['use', 'land use / zoning'], ['amount', 'amount owed'], ['rate', 'interest rate'], ['desc', 'legal description']];
for (const r of recs) {
  const ck = r.state + '|' + r.county, c = perCounty[ck] = perCounty[ck] || { state: r.state, county: r.county, files: new Set(), n: 0, fresh: {}, status: {}, missing: {}, gisMatched: 0, gisChecked: 0, sources: new Set(), checked: [], dup: 0, invalid: 0 };
  c.n++; c.files.add(r._file); if (r.source) c.sources.add(r.source); if (r.checked) c.checked.push(r.checked);
  const d = DS.describe(r, { today: TODAY });
  counters.fresh[d.freshness.key]++; c.fresh[d.freshness.key] = (c.fresh[d.freshness.key] || 0) + 1;
  counters.status[d.status.key] = (counters.status[d.status.key] || 0) + 1; c.status[d.status.key] = (c.status[d.status.key] || 0) + 1;
  if (!r.source) counters.noSource++;
  for (const [f] of FIELDS) { const v = r[f]; const empty = v == null || v === '' || (f === 'acres' && !(v > 0)); if (empty) { counters.missing[f] = (counters.missing[f] || 0) + 1; c.missing[f] = (c.missing[f] || 0) + 1; } }
  // validity (flag only; nothing is changed)
  const bad = [];
  if (r.amount != null && r.amount < 0) bad.push('negative amount');
  if (r.payoff != null && r.amount != null && r.payoff + 0.005 < r.amount) bad.push('payoff below amount');
  if (r.acres != null && (r.acres < 0 || r.acres > 5000)) bad.push('implausible acreage ' + r.acres);
  if (r.checked && DS.parseISO(r.checked) == null) bad.push('bad checked date');
  if (r.source && !/^https:\/\//.test(r.source) && /^http/.test(r.source)) bad.push('non-https source');
  const sh = shapes[ck], total = Object.values(sh).reduce((a, b) => a + b, 0), cnt = sh[shape(r.parcel)];
  if (Object.keys(sh).length > 1 && cnt / total < 0.01) bad.push('unusual parcel ID format (' + shape(r.parcel) + ')');
  if (bad.length) { c.invalid++; if (counters.invalid.length < 400) counters.invalid.push({ state: r.state, county: r.county, parcel: r.parcel, issues: bad }); }
  // cross-check with the official GIS parcel file
  const g = gisFor(r);
  if (!g) counters.gisNoFile++;
  else {
    counters.gisChecked++; c.gisChecked++;
    const p = g.p && g.p[r.parcel];
    if (p && p.st === 'matched') {
      counters.gisMatched++; c.gisMatched++;
      let confirmed = true; // parcel ID found in the official GIS layer
      if (p.own && r.owner) { counters.ownerCompared++; const a = tokens(p.own), b = tokens(r.owner); if (!a.size || !b.size) { counters.ownerCompared--; } else { const inter = [...a].filter(t => b.has(t)).length; if (inter / Math.max(1, Math.min(a.size, b.size)) >= 0.5) counters.ownerAgree++; else { confirmed = false; if (counters.ownerDiffer.length < 100) counters.ownerDiffer.push({ county: r.county, parcel: r.parcel, list: r.owner, roll: p.own }); } } }
      if (p.ac > 0 && r.acres > 0) { counters.acresCompared++; if (Math.abs(p.ac - r.acres) <= Math.max(0.02, 0.25 * p.ac)) counters.acresAgree++; else { confirmed = false; if (counters.acresDiffer.length < 100) counters.acresDiffer.push({ county: r.county, parcel: r.parcel, list: r.acres, gis: p.ac }); } }
      if (p.own) counters.rollMatched++;
      if (confirmed) counters.verified++;
    } else counters.gisUnmatched++;
  }
}
for (const g of dupGroups) { const r = g[0]; perCounty[r.state + '|' + r.county].dup += g.length - 1; }

// ---------- 3. registry ----------
const stateGuide = loadConst('states.js', 'STATES');
const reg = { built: TODAY, note: 'County-by-county sources for the data on PricePocketAsset. "reachable" only means the official page answered; it is not a check that the data matches.', counties: [], states: [] };
const tax = Object.fromEntries(taxCfg.map(x => [x.county, x]));
for (const c of Object.values(perCounty)) {
  const imp = importsCfg[c.county] || null, t = tax[c.county] || null, checked = c.checked.sort().pop() || null;
  const fr = DS.freshness({ checked }, { today: TODAY });
  const main = imp ? imp.sourceUrl : [...c.sources][0];
  reg.counties.push({ state: c.state, county: c.county, records: c.n, files: [...c.files], sourceName: imp ? imp.sourceName : null, sourceUrl: main || null, fileUrl: imp ? imp.fileUrl || null : null,
    otherSources: [...c.sources].filter(u => u !== main).slice(0, 4), calendarUrl: t && t.calendar ? t.calendar.url : null, saleTypes: t ? t.integrated : null,
    updateMode: imp ? (imp.fileUrl ? 'automated import (official file)' : 'import adapter (official list)') : 'manual copy of the official list', lastChecked: checked, freshness: fr.key, ageDays: fr.days,
    statusMix: c.status, gisParcels: c.gisChecked ? { checked: c.gisChecked, matched: c.gisMatched } : null, health: health[c.county] ? { ok: health[c.county].ok, status: health[c.county].status, lastSuccess: health[c.county].lastSuccess } : null, probe: null });
}
reg.counties.sort((a, b) => a.state.localeCompare(b.state) || a.county.localeCompare(b.county));
for (const s of stateGuide) reg.states.push({ state: s.a, name: s.n, system: s.sys, officialLinks: (s.links || []).slice(0, 3).map(l => ({ name: l[0], url: l[1] })), countyDataLoaded: reg.counties.filter(c => c.state === s.a).length, stateDatasets: stateSets.filter(x => x.state === s.a).map(x => ({ name: x.name, records: x.records, checked: x.checked, source: x.source })) });

// ---------- 4. optional polite probes ----------
async function probe(url) {
  if (!url) return { ok: false, status: null, note: 'no URL' };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctl.signal }); clearTimeout(t); try { await r.body && r.body.cancel(); } catch (e) {}
    const blocked = [401, 403, 405, 406, 429].includes(r.status); return { ok: r.ok, status: r.status, note: r.ok ? '' : blocked ? 'blocks automated requests (not worked around)' : 'error' }; }
  catch (e) { clearTimeout(t); return { ok: false, status: null, note: String(e.name === 'AbortError' ? 'timed out' : e.message).slice(0, 80) }; }
}
if (PROBE) { for (const c of reg.counties) { const u = c.sourceUrl; const p = await probe(u); c.probe = Object.assign({ url: u, checked: TODAY }, p); if (c.fileUrl) { await new Promise(r => setTimeout(r, 1000)); c.fileProbe = Object.assign({ url: c.fileUrl, checked: TODAY }, await probe(c.fileUrl)); } await new Promise(r => setTimeout(r, 1000)); process.stdout.write('.'); } console.log(); }

// ---------- 5. write ----------
fs.writeFileSync(path.join(STATES_DIR, 'data-registry.json'), JSON.stringify(reg));
const rep = { auditDate: TODAY, generatedBy: 'tools/audit/audit.mjs', readOnly: true,
  totals: { lienRecords: counters.total, countyFiles: new Set(recs.map(r => r._file)).size, counties: reg.counties.length, stateLevelRecords: stateSets.reduce((n, s) => n + (s.records || 0), 0), stateDatasets: stateSets.length },
  freshness: counters.fresh, status: counters.status, noSourceLink: counters.noSource,
  duplicates: { exactDuplicateGroups: dupGroups.length, extraCopies: dupGroups.reduce((n, g) => n + g.length - 1, 0), examples: dupGroups.slice(0, 10).map(g => ({ county: g[0].county, parcel: g[0].parcel, cert: g[0].cert, copies: g.length, files: [...new Set(g.map(x => x._file))] })), parcelsWithMultipleCertificates: multiCert.length, note: 'Several certificates on one parcel are normal and are not counted as duplicates.' },
  missingInformation: Object.fromEntries(FIELDS.map(([f, n]) => [n, counters.missing[f] || 0])),
  validation: { recordsWithIssues: counters.invalid.length, examples: counters.invalid.slice(0, 40) },
  crossVerification: { gisFileExists: counters.gisChecked, noGisFileForCounty: counters.gisNoFile, parcelIdMatchedInOfficialGis: counters.gisMatched, notMatched: counters.gisUnmatched, ownerCompared: counters.ownerCompared, ownerAgrees: counters.ownerAgree, ownerDiffers: counters.ownerCompared - counters.ownerAgree, acresCompared: counters.acresCompared, acresAgree: counters.acresAgree, acresDiffer: counters.acresCompared - counters.acresAgree, verifiedRecords: counters.verified, ownerMismatchExamples: counters.ownerDiffer.slice(0, 15), acreageMismatchExamples: counters.acresDiffer.slice(0, 15) },
  stateDatasets: stateSets,
  counties: reg.counties.map(c => ({ state: c.state, county: c.county, records: c.records, freshness: c.freshness, ageDays: c.ageDays, updateMode: c.updateMode, sourceUrl: c.sourceUrl, probe: c.probe, fileProbe: c.fileProbe || null, gis: c.gisParcels, statusMix: c.statusMix })),
  probed: PROBE };
const dir = path.join(ROOT, 'tools/audit/reports'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'audit-' + TODAY + '.json'), JSON.stringify(rep, null, 1));
console.log(JSON.stringify({ totals: rep.totals, freshness: rep.freshness, status: rep.status, duplicates: { groups: rep.duplicates.exactDuplicateGroups, extra: rep.duplicates.extraCopies }, verified: rep.crossVerification.verifiedRecords, gisMatched: rep.crossVerification.parcelIdMatchedInOfficialGis, issues: rep.validation.recordsWithIssues }, null, 1));
