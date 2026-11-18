// Refreshes the Virginia Beach dataset from the City's own public GIS services (no key needed):
//   table  : Delinquent Real Estate Taxes (City of Virginia Beach GIS, VBCGIS)
//   parcels: Property_Information MapServer layer 12 (outlines, land use, zoning, FEMA flood zone), read per GPIN
// node tools/delinquent/refresh.mjs
// PRIVACY: owner name / mailing address columns are read only so the table rows stay intact for the shared builder, and are
// dropped by build.mjs. They are never written to any output.
import fs from 'node:fs'; import path from 'node:path';
import { build } from './build.mjs';
const UA = 'PricePocketAsset research (https://pricepocketasset.com)';
const TABLE = 'https://services2.arcgis.com/CyVvlIiUfRBmMQuu/arcgis/rest/services/Delinquent_Real_Estate_Taxes_view/FeatureServer/0';
const PARCELS = 'https://geo.vbgov.com/mapservices/rest/services/Basemaps/Property_Information/MapServer/12';
const j = async (url, body) => { const r = await fetch(url, body ? { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() } : { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(url + ' HTTP ' + r.status); const d = await r.json(); if (d.error) throw new Error(url + ' ' + JSON.stringify(d.error).slice(0, 160)); return d; };
const COLS = ['Owner_Name', 'Mailing_Address', 'City_State_Zip', 'GPIN', 'Situs_Address', 'Property_Description', 'District', 'Tax_Year', 'Bill_Number', 'Installment', 'Tax_Due', 'Penalty_Due', 'Interest_Due', 'Fee_Due', 'Total_Delinquent_Amount_Due', 'OBJECTID'];
const q = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const meta = await j(TABLE + '?f=json'); const edit = meta.editingInfo && (meta.editingInfo.dataLastEditDate || meta.editingInfo.lastEditDate);
const asOf = edit ? new Date(edit).toISOString().slice(0, 10) : null;
const count = (await j(TABLE + '/query?where=1%3D1&returnCountOnly=true&f=json')).count; const rows = [];
for (let off = 0; off < count; off += 1000) { const d = await j(TABLE + '/query', { where: '1=1', outFields: '*', orderByFields: 'OBJECTID', resultOffset: off, resultRecordCount: 1000, returnGeometry: 'false', f: 'json' }); d.features.forEach(f => rows.push(f.attributes)); }
console.log('table rows', rows.length, 'of', count, 'as of', asOf);
const csv = [COLS.join(',')].concat(rows.map(a => COLS.map(c => q(a[c])).join(','))).join('\n');
const { parcels, summary } = build(csv, { asOf, received: new Date().toISOString().slice(0, 10), source: 'City of Virginia Beach GIS (VBCGIS) public service: Delinquent Real Estate Taxes table, read directly from the city on ' + new Date().toISOString().slice(0, 10) + '. Data last edited by the city ' + asOf + '.', sourceUrl: TABLE });
summary.sourceUrl = TABLE; summary.parcelSource = { name: 'City of Virginia Beach GIS: Property Information, Parcels layer', url: PARCELS };

// parcel outlines and facts (city layer 12), in batches
const gpins = parcels.map(p => p.g), geo = {}; const rnd = n => Math.round(n * 1e5) / 1e5;
for (let i = 0; i < gpins.length; i += 80) {
  const list = gpins.slice(i, i + 80).map(g => "'" + g + "'").join(',');
  const d = await j(PARCELS + '/query', { where: 'PAR_GPIN IN (' + list + ')', outFields: 'PAR_GPIN,PROP_ADDRESS,LAND_USE,SUBDIVISION,ZONING,FEMA_ZONE_BLDG,PROP_CLASS,TAX_AREA', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.00002', geometryPrecision: '5', f: 'json' });
  for (const f of d.features) { const a = f.attributes, g = String(a.PAR_GPIN || '').trim(); if (!g || !f.geometry || !f.geometry.rings) continue;
    const rings = f.geometry.rings.map(r => r.map(pt => [rnd(pt[0]), rnd(pt[1])])); const o = geo[g] || { r: [], ac: 0 }; o.r.push(...rings);
    o.ac = a.TAX_AREA ? Math.round(a.TAX_AREA / 43560 * 1000) / 1000 : o.ac; o.lu = (a.LAND_USE || '').trim(); o.sd = (a.SUBDIVISION || '').trim(); o.zn = (a.ZONING || '').trim(); o.fz = (a.FEMA_ZONE_BLDG || '').trim(); o.pc = (a.PROP_CLASS || '').trim(); geo[g] = o; }
}
// second pass: condo units and similar have no outline in layer 12; try the city's Recorded Parcels layer (13), outline only
const REC = 'https://geo.vbgov.com/mapservices/rest/services/Basemaps/Property_Information/MapServer/13';
const miss = gpins.filter(g => !geo[g]);
for (let i = 0; i < miss.length; i += 80) {
  const list = miss.slice(i, i + 80).map(g => "'" + g + "'").join(',');
  const d = await j(REC + '/query', { where: 'PAR_GPIN IN (' + list + ')', outFields: 'PAR_GPIN', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.00002', geometryPrecision: '5', f: 'json' });
  for (const f of d.features) { const g = String(f.attributes.PAR_GPIN || '').trim(); if (!g || !f.geometry || !f.geometry.rings) continue; const o = geo[g] || { r: [], ac: 0, rec: true }; o.r.push(...f.geometry.rings.map(r => r.map(pt => [rnd(pt[0]), rnd(pt[1])]))); geo[g] = o; }
}
const matched = gpins.filter(g => geo[g]).length;
summary.outlines = { matched, of: gpins.length, recordedOnly: gpins.filter(g => geo[g] && geo[g].rec).length };
fs.writeFileSync(path.join(root, 'netlify/private/delinquent/virginia-beach.json'), JSON.stringify({ dataset: summary.dataset, built: new Date().toISOString().slice(0, 10), p: parcels }));
fs.writeFileSync(path.join(root, 'netlify/private/delinquent/virginia-beach-geo.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), g: geo }));
fs.writeFileSync(path.join(root, 'kinvest-liens/liens/delinquent/virginia-beach-summary.json'), JSON.stringify(summary, null, 1));
console.log('parcels', parcels.length, 'owed', summary.owed, '| outlines matched', matched, 'of', gpins.length, '| geo file KB', Math.round(fs.statSync(path.join(root, 'netlify/private/delinquent/virginia-beach-geo.json')).size / 1024));
