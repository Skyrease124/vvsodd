// Cross-check: each Colorado/Arizona county list record vs the county's own GIS attributes (owner, site address, acres where the county publishes them).
// Fetches live from the county ArcGIS services (honest UA). Read-only: nothing on the site is changed. Mailing addresses are never read.
// A disagreement is a flag to verify with the county, not a ruling on which source is right. Writes tools/crosscheck/report.json.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..'), ST = path.join(ROOT, 'kinvest-liens/liens/states');
const UA = { 'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)', 'Content-Type': 'application/x-www-form-urlencoded' };
const SRC = {
  'liens-larimer.js': { url: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3/query', key: 'PARCELNUM', id: p => p, owner: ['NAME', 'NAME1'], addr: ['LOCADDRESS'] },
  'liens-boulder.js': { url: 'https://maps.bouldercounty.org/arcgis/rest/services/PARCELS/PARCELS_OWNER/FeatureServer/0/query', key: 'AccountNo', id: p => p, owner: ['OwnerName'], addr: ['StrNum', 'StrPrx', 'Street', 'StrSuf'] },
  'liens-pinal.js': { url: 'https://gis.pinal.gov/mapping/rest/services/TaxParcels/FeatureServer/3/query', key: 'PARCELID', id: p => p.slice(0, 9), owner: ['OWNERNME1', 'OWNERNME2'], addr: ['SITEADDRESS'], acres: 'GROSSAC' },
  'liens-coconino.js': { url: 'https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/Coconino_County_Parcels_Open_Data/FeatureServer/0/query', key: 'APN', id: p => p, owner: [], addr: ['SITUS'] } };
const tidy = s => String(s || '').replace(/\s+/g, ' ').trim();
const toks = s => new Set(tidy(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !/^(LLC|INC|CORP|CO|THE|ET|AL|UX|TRUST|TR|JR|SR|OF|AND|FAMILY|LIVING|REVOCABLE)$/.test(w)));
const sameOwner = (a, ...gis) => { const A = toks(a), G = new Set(gis.flatMap(g => [...toks(g)])); if (!A.size || !G.size) return null; let n = 0; A.forEach(w => { if (G.has(w)) n++; }); return n / A.size >= 0.5; };
const num = s => { const m = String(s || '').replace(/^(\d+)\s*(?:#|APT|UNIT).*/i, '$1').match(/^\d+/); return m ? m[0] : null; };
async function q(url, params) { for (let a = 0; a < 4; a++) { try { const r = await fetch(url, { method: 'POST', headers: UA, body: new URLSearchParams(params), signal: AbortSignal.timeout(90000) }); const d = await r.json(); if (d.error) throw new Error(JSON.stringify(d.error)); return d; } catch (e) { if (a === 3) throw e; await new Promise(r => setTimeout(r, 3000 * (a + 1))); } } }
const report = {}, differ = {};
for (const [f, S] of Object.entries(SRC)) {
  const ctx = {}; vm.runInNewContext('var LIENS=[];\n' + fs.readFileSync(path.join(ST, f), 'utf8') + '\n;this.L=LIENS', ctx, { timeout: 8000 }); const L = ctx.L, county = L[0].county, state = L[0].state;
  const want = [...new Set(L.map(l => S.id(l.parcel)))], got = {}, fields = [S.key, ...S.owner, ...S.addr, ...(S.acres ? [S.acres] : [])].join(',');
  try { for (let i = 0; i < want.length; i += 80) { const ch = want.slice(i, i + 80); const d = await q(S.url, { where: S.key + " IN (" + ch.map(x => "'" + x.replace(/'/g, "''") + "'").join(',') + ")", outFields: fields, returnGeometry: 'false', f: 'json' }); for (const ft of d.features || []) got[tidy(ft.attributes[S.key])] = ft.attributes; } } catch (e) { report[state + '-' + county] = { county, state, error: String(e.message).slice(0, 160) }; continue; }
  const o = { county, state, records: L.length, found: 0, notFound: 0, checks: { owner: [0, 0, 0], address: [0, 0, 0], acres: [0, 0, 0] }, examples: { owner: [], address: [], acres: [] }, fields: { owner: S.owner.length > 0, address: true, acres: !!S.acres } };
  for (const l of L) {
    const a = got[S.id(l.parcel)]; if (!a) { o.notFound++; continue; } o.found++;
    if (S.owner.length) { const so = sameOwner(l.owner, ...S.owner.map(k => a[k])); const c = o.checks.owner; if (so === null) c[2]++; else if (so) c[0]++; else { c[1]++; (differ[state + '-' + county] ||= {})[l.parcel] = S.owner.map(k => tidy(a[k])).filter(Boolean).join(' / '); if (o.examples.owner.length < 6) o.examples.owner.push({ parcel: l.parcel, list: l.owner, county_gis: S.owner.map(k => tidy(a[k])).filter(Boolean).join(' / ') }); } }
    const ga = S.addr.map(k => tidy(a[k])).filter(Boolean).join(' '), la = tidy(l.address || ''); { const c = o.checks.address; if (!ga || !la || !num(ga) || !num(la) || num(la) === '0' || num(ga) === '0') c[2]++; else if (num(ga) === num(la)) c[0]++; else { c[1]++; if (o.examples.address.length < 6) o.examples.address.push({ parcel: l.parcel, list: la, county_gis: ga }); } }
    if (S.acres) { const la2 = parseFloat(l.acres), ga2 = parseFloat(a[S.acres]); const c = o.checks.acres; if (!(la2 > 0) || !(ga2 > 0)) c[2]++; else if (Math.abs(la2 - ga2) / Math.max(la2, ga2) <= 0.1 || Math.abs(la2 - ga2) < 0.02) c[0]++; else { c[1]++; if (o.examples.acres.length < 6) o.examples.acres.push({ parcel: l.parcel, list: la2, county_gis: ga2 }); } }
  }
  report[state + '-' + county] = o;
}
fs.writeFileSync(path.join(HERE, 'owners.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), note: 'Parcels where the county GIS owner differs from the county sale list owner. Source: county GIS services, fetched by tools/crosscheck/run.mjs.', differ }));
report._built = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(HERE, 'report.json'), JSON.stringify(report, null, 1));
for (const [k, o] of Object.entries(report)) if (k[0] !== '_') console.log(k, o.error || JSON.stringify({ records: o.records, found: o.found, notFound: o.notFound, 'owner[agree,differ,n/a]': o.checks.owner, 'address': o.checks.address, 'acres': o.checks.acres }));
