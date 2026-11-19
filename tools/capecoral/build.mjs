// Builds kinvest-liens/liens/states/capecoral-facts.json: city records for the Lee County parcels we list that are inside Cape Coral.
// Source: City of Cape Coral "Ownership AGOL" public feature layer (ArcGIS Online). Only parcels already on our official lists are fetched.
// Run: node tools/capecoral/build.mjs        (keeps the old file if the source does not answer)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LAYER = 'https://services1.arcgis.com/MZl3VrkZJOk1VhY4/arcgis/rest/services/Ownership_AGOL/FeatureServer/0';
const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const FIELDS = 'Strap,Site_Address,City,Assessed,Land,Building,Zoning,Future_Land_Use,Acres,WATER,SEWER,w_srv_avail,s_srv_avail,Canal,Owlzone,Turtlezone,Sale1Date,Sale1Amount,Leepa_Lnk';
export const strapOf = p => String(p || '').replace(/[-.\s]/g, '').toUpperCase();
const yn = v => /^y/i.test(String(v || '')) ? 'Yes' : /^n/i.test(String(v || '')) ? 'No' : '';
const num = v => Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null;
const txt = v => String(v == null ? '' : v).trim();
export function shape(a) {
  const sale = num(a.Sale1Date), leepa = txt(a.Leepa_Lnk);
  return {
    addr: txt(a.Site_Address), zoning: txt(a.Zoning), flu: txt(a.Future_Land_Use), acres: num(a.Acres),
    assessed: num(a.Assessed), land: num(a.Land), bldg: num(a.Building),
    water: yn(a.w_srv_avail), sewer: yn(a.s_srv_avail), canal: txt(a.Canal), owl: txt(a.Owlzone), turtle: txt(a.Turtlezone),
    saleDate: sale ? new Date(sale).toISOString().slice(0, 10) : '', saleAmt: num(a.Sale1Amount) || null,
    leepa: /^https:\/\/www\.leepa\.org\//.test(leepa) ? leepa : '',
  };
}
async function query(where) {
  const r = await fetch(LAYER + '/query', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ where, outFields: FIELDS, returnGeometry: 'false', f: 'json' }) });
  if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json(); if (d.error) throw new Error(JSON.stringify(d.error).slice(0, 200)); return d.features || [];
}
async function main() {
  const up = JSON.parse(fs.readFileSync(path.join(ROOT, 'kinvest-liens/liens/states/upcoming-sales.json'), 'utf8'));
  const ids = [...new Set((up.listings || []).filter(x => x.county === 'Lee' && (x.state || 'FL') === 'FL' && x.parcel).map(x => strapOf(x.parcel)))];
  const facts = {};
  for (let i = 0; i < ids.length; i += 80) for (const f of await query("Strap IN ('" + ids.slice(i, i + 80).map(s => s.replace(/'/g, '')).join("','") + "')")) { const a = f.attributes; if (/cape coral/i.test(a.City || '')) facts[strapOf(a.Strap)] = shape(a); }
  const out = { source: { name: 'City of Cape Coral GIS, Ownership layer (public ArcGIS Online feature layer)', url: 'https://data-capecoral.opendata.arcgis.com/', checked: new Date().toISOString().slice(0, 10) }, facts };
  fs.writeFileSync(path.join(ROOT, 'kinvest-liens/liens/states/capecoral-facts.json'), JSON.stringify(out));
  console.log('Lee parcels on our lists:', ids.length, '| Cape Coral records found:', Object.keys(facts).length);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error('Cape Coral source did not answer; kept the existing file.', e.message); process.exit(1); });
