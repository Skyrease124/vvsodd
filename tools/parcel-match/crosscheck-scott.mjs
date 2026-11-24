// Scott County, Iowa: cross-checks for the records the exact parcel match could not place.
// Reads free county ArcGIS layers (no key, no paid service), records each check in the server-side audit, and leaves
// the 22 matched records untouched. Run it after tools/parcel-match/run.mjs, which writes the audit from the list.
//   node tools/parcel-match/crosscheck-scott.mjs            query the layers (responses are cached under tools/parcel-match/cache)
//   node tools/parcel-match/crosscheck-scott.mjs --offline  rebuild the audit from the cache only
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SOURCES} from '../../netlify/lib/gis-sources.mjs';
import {parseAddress, closeRing, representativePoint, pointInRing, checkRing} from '../../netlify/lib/parcel-match.mjs';
import * as core from './crosscheck-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT_FILE = path.join(ROOT, 'netlify/lib/data/parcel-matches/IA-scott.json');
const LIST_FILE = path.join(ROOT, 'kinvest-liens/map/data/IA-scott.json');
const CACHE = path.join(ROOT, 'tools/parcel-match/cache/scott-crosscheck');
const OFFLINE = process.argv.includes('--offline');
const ORG = 'https://services.arcgis.com/ovln19YRWV44nBqV/arcgis/rest/services';
const LAYERS = {
  parcel: ORG + '/Cadastral/FeatureServer/3',
  subdivision: ORG + '/Cadastral/FeatureServer/1',
  cityLimits: ORG + '/City_Limits/FeatureServer/0',
  history: ORG + '/SCFeatures_DBO_Parcel_Hist_25/FeatureServer/28',
  taxDeed: ORG + '/ParcelTaxDeed/FeatureServer/0',
  addresses: ORG + '/SC_Addresses/FeatureServer/0',
};
const CONFIG = SOURCES['scott-county-ia-parcels'];
const [X0, Y0, X1, Y1] = CONFIG.bbox;
const inCounty = p => p[0] >= X0 && p[0] <= X1 && p[1] >= Y0 && p[1] <= Y1;
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
const queryLink = (layer, where) => layer + '/query?where=' + encodeURIComponent(where) + '&outFields=*&f=html';
const verdict = v => (v === true ? 'agrees' : v === false ? 'differs' : 'not_available');

// One layer query. Responses are cached by request, so --offline reproduces the same audit. A truncated result
// is an error, never a silent partial list.
async function query(layer, params) {
  const body = {f: 'json', ...params};
  const key = crypto.createHash('sha256').update(layer + '\n' + JSON.stringify(body)).digest('hex').slice(0, 40);
  const file = path.join(CACHE, key + '.json');
  let data;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    if (OFFLINE) throw new Error('Not in the cache: ' + layer + '. Run without --offline to query the county layer.');
    const res = await fetch(layer + '/query', {method: 'POST', body: new URLSearchParams(body)});
    if (!res.ok) throw new Error('County layer HTTP ' + res.status + ': ' + layer);
    data = await res.json();
    if (data.error) throw new Error('County layer error: ' + JSON.stringify(data.error).slice(0, 200));
    fs.mkdirSync(CACHE, {recursive: true});
    fs.writeFileSync(file, JSON.stringify(data));
  }
  if (data.exceededTransferLimit) throw new Error('The county layer truncated a result (' + layer + '). Narrow the query.');
  return data;
}

async function pointQuery(layer, point, field) {
  const d = await query(layer, {geometry: JSON.stringify({x: point[0], y: point[1]}), geometryType: 'esriGeometryPoint',
    inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: field, returnGeometry: 'false'});
  return (d.features || []).map(f => String(f.attributes[field] ?? '').trim()).filter(Boolean);
}

const audit = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8')).recs;
const listOwner = new Map(list.map(r => [r.p, r.o]));
const matchedBefore = JSON.stringify(audit.records.filter(r => r.status === 'matched'));
const pending = audit.records.filter(r => r.status !== 'matched');
const pins = pending.map(r => r.parcel);

// 1. The parcel layer by exact PIN, the same rule the matcher uses.
const inLayer = new Map();
for (const part of chunks(pins, 25)) {
  const d = await query(LAYERS.parcel, {where: 'PIN IN (' + part.map(q).join(',') + ')',
    outFields: 'PIN,AlternateID,PropertyAddress,LegalDesc1,PropClass,DeedHold,Gross_AC,TaxJuris', returnGeometry: 'true', outSR: '4326'});
  for (const f of d.features || []) inLayer.set(f.attributes.PIN, f);
}

// 2. The tax-deed layer for every pending number, and the parcel history for the numbers the parcel layer does not hold.
// Both are case-insensitive; the tax-deed layer is also matched by alternate name.
const outside = pins.filter(p => !inLayer.has(p));
const history = new Map(), taxDeed = new Map();
for (const part of chunks(pins, 40)) {
  const up = part.map(x => q(x.toUpperCase()));
  const t = await query(LAYERS.taxDeed, {where: 'UPPER(PIN) IN (' + up.join(',') + ') OR UPPER(ALT_NAME) IN (' + up.join(',') + ')',
    outFields: 'PIN,PIN_TYPE,ALT_NAME,PropertyAddress,DeedHold', returnGeometry: 'false', resultRecordCount: '200'});
  for (const f of t.features || []) taxDeed.set(String(f.attributes.PIN).toUpperCase(), f.attributes);
}
for (const part of chunks(outside, 40)) {
  const up = part.map(x => q(x.toUpperCase()));
  const h = await query(LAYERS.history, {where: 'UPPER(PIN) IN (' + up.join(',') + ')',
    outFields: 'PIN,AlternateID,DeedHold,PropertyAddress,LegalDesc1,PropClass', returnGeometry: 'false', resultRecordCount: '200'});
  for (const f of h.features || []) history.set(String(f.attributes.PIN).toUpperCase(), f.attributes);
}

// 3. Lot addresses ("5112 N Fairmount St Lot 076") and the address points and parcels on each street number.
const lotOf = new Map();
for (const r of pending) {
  if (!r.address || inLayer.has(r.parcel)) continue;
  const lot = core.splitLot(r.address);
  if (lot) lotOf.set(r.parcel, lot);
}
const numbers = [...new Set([...lotOf.values()].map(l => parseAddress(l.base).number).filter(Boolean))];
const pointRows = new Map(), parcelRows = new Map();
for (const num of numbers) {
  const a = await query(LAYERS.addresses, {where: "UPPER(STRADD) LIKE '" + num + " %'",
    outFields: 'STRADD,UNITTYP,UNITID,LAT,LONG,COMM,SOURCE', returnGeometry: 'false', resultRecordCount: '2000'});
  pointRows.set(num, (a.features || []).map(f => f.attributes));
  const p = await query(LAYERS.parcel, {where: "UPPER(PropertyAddress) LIKE '" + num + " %'",
    outFields: 'PIN,PropertyAddress,DeedHold,PropClass', returnGeometry: 'false', resultRecordCount: '2000'});
  parcelRows.set(num, (p.features || []).map(f => f.attributes));
}

// 4. Each pending record: the official check it can receive, and the reason it stays pending.
const ADDRESS_SOURCE = 'Scott County E911 address points (SC_Addresses, ArcGIS)';
const homeCheck = {check: 'home_identity', result: 'not_available',
  detail: 'the serial or title number of the home is not in the free county GIS; check the county treasurer\'s mobile home record'};
for (const r of pending) {
  const f = inLayer.get(r.parcel);
  if (f) {
    if (r.address) throw new Error(r.parcel + ': in the parcel layer and on the list with an address, which the matcher must decide');
    const attrs = f.attributes;
    const ring = closeRing(f.geometry.rings[0]);
    const problem = checkRing(ring, CONFIG.bbox);
    if (problem) throw new Error(r.parcel + ': the official ring is not usable (' + problem + ')');
    const point = representativePoint(ring);
    if (!point || !pointInRing(point, ring)) throw new Error(r.parcel + ': no point inside the official parcel');
    const poly = core.parcelPolygon(ring, point);
    const owner = listOwner.get(r.parcel) || null;
    const ownerOk = core.ownerAgrees(owner, attrs.DeedHold);
    const acreOk = core.acreageAgrees(poly.acres, attrs.Gross_AC);
    const subdivisions = await pointQuery(LAYERS.subdivision, point, 'Subdivision_Name');
    const subdivision = subdivisions[0] || null;
    const legalOk = core.legalNamesSubdivision(attrs.LegalDesc1, subdivision);
    const cityLimits = await pointQuery(LAYERS.cityLimits, point, 'Name');
    const inCity = cityLimits.length > 0;
    const juriOk = core.jurisdictionAgrees(attrs.TaxJuris, inCity);
    r.reason = 'identifier_only';
    r.candidate = {...poly, strength: core.strengthOf({owner: ownerOk, acreage: acreOk, legal: legalOk, jurisdiction: juriOk}),
      source: CONFIG.label, evidenceUrl: queryLink(LAYERS.parcel, "PIN='" + r.parcel + "'"),
      official: {parcelId: attrs.AlternateID, printKey: attrs.PIN, owner: attrs.DeedHold, taxJurisdiction: attrs.TaxJuris,
        grossAcres: attrs.Gross_AC, legal: core.firstLine(attrs.LegalDesc1), subdivision, inCityLimits: inCity}};
    r.crossChecks = [
      {check: 'parcel_number', result: 'agrees', detail: 'exact PIN in the official parcel layer'},
      {check: 'owner', result: verdict(ownerOk), detail: 'list ' + owner + ' · official ' + attrs.DeedHold},
      {check: 'acreage', result: verdict(acreOk), detail: poly.acres.toFixed(3) + ' acre from the drawn parcel · assessor ' + attrs.Gross_AC + ' acre'},
      {check: 'legal', result: verdict(legalOk), detail: subdivision ? 'legal description checked against the subdivision "' + subdivision + '" at the parcel' : 'no subdivision polygon at the parcel'},
      {check: 'jurisdiction', result: verdict(juriOk), detail: attrs.TaxJuris + (inCity ? ', inside city limits' : ', outside city limits')},
      {check: 'address', result: 'not_on_list', detail: 'the list gives no street address'},
      {check: 'list_fields', result: 'not_on_list', detail: 'the list carries only the parcel number and the owner'},
      {check: 'tax_deed_layer', result: taxDeed.has(r.parcel.toUpperCase()) ? 'found' : 'not_found',
        detail: taxDeed.has(r.parcel.toUpperCase()) ? 'a second record for this PIN in the tax-deed layer' : 'no second record for this PIN in the tax-deed layer'},
    ];
    r.landContext = [];
    continue;
  }
  if (outside.indexOf(r.parcel) < 0) throw new Error(r.parcel + ': not classified');
  const h = history.get(r.parcel.toUpperCase()) || null;
  const t = taxDeed.get(r.parcel.toUpperCase()) || null;
  if (t) throw new Error(r.parcel + ': in the tax-deed layer but not the parcel layer; review by hand');
  const common = [
    {check: 'parcel_layer', result: 'not_found', detail: 'the PIN is not in the official parcel layer'},
    {check: 'parcel_history', result: h ? 'found' : 'not_found',
      detail: h ? 'in the 2025 parcel history as ' + (h.AlternateID || 'an earlier number') + ', not in the current layer' : 'not in the 2025 parcel history'},
    {check: 'tax_deed_layer', result: 'not_found', detail: 'not in the tax-deed parcel layer'},
  ];
  const lot = lotOf.get(r.parcel);
  if (!r.address) {
    r.reason = h ? 'retired_parcel_number' : 'no_official_record';
    r.candidate = null;
    r.crossChecks = [...common, {check: 'lot_address_point', result: 'not_available', detail: 'the list gives no address'}];
    r.landContext = [];
    continue;
  }
  if (!lot) {
    r.reason = 'lot_number_missing';
    r.candidate = null;
    r.crossChecks = [...common, {check: 'lot_address_point', result: 'not_available', detail: 'the address has no lot number'}];
    r.landContext = [];
    continue;
  }
  const num = parseAddress(lot.base).number;
  const rowsHere = pointRows.get(num) || [];
  const parcels = core.parcelsAtAddress(parcelRows.get(num) || [], lot.base);
  const landCheck = {check: 'land_parcels_at_address', result: 'context_only',
    detail: parcels.length ? parcels.length + ' land parcel(s) at this street number and street: context only, not a position for the home' : 'no land parcel at this street number and street'};
  const points = core.lotPoints(rowsHere, lot.base, lot.unit);
  if (points.length === 1) {
    const p = points[0];
    const point = [Number(p.LONG), Number(p.LAT)];
    if (!inCounty(point)) throw new Error(r.parcel + ': address point outside the county');
    r.reason = 'manufactured_home_address_point';
    r.candidate = {precision: 'address_point', point, source: ADDRESS_SOURCE, address: p.STRADD, strength: 'address',
      evidenceUrl: queryLink(LAYERS.addresses, "UPPER(STRADD)='" + String(p.STRADD).toUpperCase() + "'")};
    r.crossChecks = [...common, {check: 'lot_address_point', result: 'agrees', detail: 'the list address is the official address point ' + p.STRADD}, homeCheck, landCheck];
  } else if (points.length > 1) {
    r.reason = 'lot_address_ambiguous';
    r.candidate = null;
    r.crossChecks = [...common, {check: 'lot_address_point', result: 'differs', detail: points.length + ' official address points match this lot; a person must decide'}, homeCheck, landCheck];
  } else {
    r.reason = 'manufactured_home_no_address_point';
    r.candidate = null;
    r.crossChecks = [...common, {check: 'lot_address_point', result: 'not_found',
      detail: core.streetHasAddressPoints(rowsHere, lot.base) ? 'the street has official address points, but none for this lot' : 'the street has no official address points in the county layer'},
      homeCheck, landCheck];
  }
  r.landContext = parcels;
}

// 5. Checks the output before it is written: the matched records are unchanged, and every position is in place.
if (JSON.stringify(audit.records.filter(r => r.status === 'matched')) !== matchedBefore) throw new Error('A matched record changed');
for (const r of audit.records) {
  if (r.status === 'matched') { if (r.candidate) throw new Error(r.parcel + ': a matched record carries a candidate'); continue; }
  if (!r.candidate) continue;
  if (r.candidate.precision === 'parcel_polygon') {
    if (!pointInRing(r.candidate.point, r.candidate.boundary) || checkRing(r.candidate.boundary, CONFIG.bbox)) throw new Error(r.parcel + ': candidate polygon fails the checks');
  } else if (r.candidate.precision === 'address_point') {
    if (r.candidate.boundary || !inCounty(r.candidate.point)) throw new Error(r.parcel + ': a home position must be an address point, never a polygon');
  } else throw new Error(r.parcel + ': unknown candidate precision');
}

const summary = {records: audit.records.length, matched: 0, matchedWithBoundary: 0, matchedPointOnly: 0, pending: 0, byReason: {}, candidates: {parcelPolygon: 0, addressPoint: 0, strong: 0, review: 0}};
for (const r of audit.records) {
  if (r.status === 'matched') { summary.matched++; if (r.boundary) summary.matchedWithBoundary++; else summary.matchedPointOnly++; }
  else summary.pending++;
  summary.byReason[r.reason] = (summary.byReason[r.reason] || 0) + 1;
  if (r.candidate?.precision === 'parcel_polygon') { summary.candidates.parcelPolygon++; summary.candidates[r.candidate.strength]++; }
  if (r.candidate?.precision === 'address_point') summary.candidates.addressPoint++;
}
audit.summary = summary;
audit.generatedAt = new Date().toISOString();
const retrievedAt = audit.generatedAt;
audit.crossCheckSources = [
  {id: 'scott-county-ia-cadastral-parcels', label: 'Scott County Cadastral: parcel layer (legal description, owner, acreage, polygon)', layerUrl: LAYERS.parcel, retrievedAt, disclaimer: audit.sources[0].disclaimer},
  {id: 'scott-county-ia-subdivisions', label: 'Scott County Cadastral: subdivision layer', layerUrl: LAYERS.subdivision, retrievedAt, disclaimer: audit.sources[0].disclaimer},
  {id: 'scott-county-ia-city-limits', label: 'Scott County: city limits layer', layerUrl: LAYERS.cityLimits, retrievedAt, disclaimer: audit.sources[0].disclaimer},
  {id: 'scott-county-ia-parcel-history', label: 'Scott County: parcel history 2025 (earlier numbers)', layerUrl: LAYERS.history, retrievedAt, disclaimer: audit.sources[0].disclaimer},
  {id: 'scott-county-ia-tax-deed-parcels', label: 'Scott County: tax-deed parcel layer', layerUrl: LAYERS.taxDeed, retrievedAt, disclaimer: audit.sources[0].disclaimer},
  {id: 'scott-county-ia-address-points', label: ADDRESS_SOURCE, layerUrl: LAYERS.addresses, retrievedAt, disclaimer: audit.sources[0].disclaimer},
];
fs.writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 1) + '\n');
console.log('Scott County cross-check written to', path.relative(ROOT, AUDIT_FILE));
console.log(JSON.stringify(summary, null, 1));
