'use strict';
// Review-first Florida parcel refresh.
// Matches a county's records to the Florida statewide parcel layer by exact parcel ID, the same rule the
// map already uses, and stages a proposed map file with a review report. It never writes to
// kinvest-liens/map/data. Publishing is a separate, reviewed step.
// Live requests run only with --live. Without it the script works offline, from a saved --fixture.
//
// Usage:
//   node scripts/florida-parcel-refresh.js --dataset FL-walton --live [--max-requests 2] [--out DIR]
//   node scripts/florida-parcel-refresh.js --dataset FL-walton --fixture features.json [--out DIR]
const fs = require('node:fs/promises');
const path = require('node:path');
const { checkMapDataset } = require('./check-map-datasets');
const registry = require('../netlify/lib/data/florida-gis-registry.json');

const LAYER = Object.freeze({
  url: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
  idField: 'PARCELNO', addressField: 'PHY_ADDR1', countyField: 'CO_NO', batchSize: 50,
});
const FLORIDA_BOUNDS = [-87.7, 24.4, -79.9, 31.1];
const DEFAULT_MAX_REQUESTS = 4;
const DEFAULT_OUT = path.join('county-import-staging', 'florida-parcel-refresh');
const REVIEW_LIMIT = 200;
const SUFFIXES = { AV: 'AVE', STREET: 'ST', AVENUE: 'AVE', ROAD: 'RD', DRIVE: 'DR', BOULEVARD: 'BLVD', LANE: 'LN', COURT: 'CT', HIGHWAY: 'HWY', PLACE: 'PL', CIRCLE: 'CIR', TRAIL: 'TRL', PARKWAY: 'PKWY' };

// The statewide layer writes IDs without dashes; the map files keep them. Compare without dashes, case-insensitively.
const statewideId = value => String(value ?? '').replace(/-/g, '').trim().toUpperCase();
const streetKey = value => String(value ?? '').split(',')[0].toUpperCase().replace(/\./g, '')
  .replace(/\s+/g, ' ').trim().split(' ').map(word => SUFFIXES[word] ?? word).join(' ');
// A usable street address starts with a house number. Blank, placeholder, and city-only text is unknown.
const isUnknownAddress = value => !/^\s*\d+\s+\S/.test(String(value ?? ''));
const countyKey = value => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');

// Closed rings, inside Florida, with finite coordinates. Anything else is not drawn.
function validRings(rings) {
  if (!Array.isArray(rings) || rings.length === 0 || rings.length > 50) return false;
  const inside = point => point[0] >= FLORIDA_BOUNDS[0] && point[0] <= FLORIDA_BOUNDS[2] &&
    point[1] >= FLORIDA_BOUNDS[1] && point[1] <= FLORIDA_BOUNDS[3];
  return rings.every(ring => Array.isArray(ring) && ring.length >= 4 && ring.length <= 5000 &&
    ring.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && inside(point)) &&
    ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]);
}

function batches(ids, size = LAYER.batchSize) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

function queryFor(countyCode, ids) {
  const list = ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(',');
  const params = new URLSearchParams({
    f: 'json',
    where: `${LAYER.countyField} = ${countyCode} AND ${LAYER.idField} IN (${list})`,
    outFields: `${LAYER.idField},${LAYER.addressField}`,
    returnGeometry: 'true', outSR: '4326', resultRecordCount: String(LAYER.batchSize),
  });
  return `${LAYER.url}/query?${params}`;
}

// Pure matching. Draws a boundary only on an exact, unique parcel-ID match, as the map already does.
// Address disagreements are listed for review; they do not block drawing.
function refreshRecords(records, features) {
  const byId = new Map();
  for (const feature of features) {
    const id = statewideId(feature?.attributes?.[LAYER.idField]);
    if (id) byId.set(id, [...(byId.get(id) ?? []), feature]);
  }
  const counts = { recordsMatched: 0, unmatched: 0, ambiguous: 0, alreadyMapped: 0, boundariesAdded: 0, invalidGeometry: 0, addressDiffers: 0, addressUnknown: 0 };
  const review = [];
  const out = records.map(record => {
    const hits = byId.get(statewideId(record.p)) ?? [];
    if (hits.length === 0) { counts.unmatched += 1; return record; }
    if (hits.length > 1) {
      counts.ambiguous += 1;
      review.push({ record: record.i, reason: 'Parcel ID matches more than one statewide feature' });
      return record;
    }
    counts.recordsMatched += 1;
    const [feature] = hits;
    const layerAddress = feature.attributes?.[LAYER.addressField];
    if (isUnknownAddress(layerAddress) || isUnknownAddress(record.a)) counts.addressUnknown += 1;
    else if (streetKey(layerAddress) !== streetKey(record.a)) {
      counts.addressDiffers += 1;
      review.push({ record: record.i, reason: 'Layer address differs from the record address', layerAddress, recordAddress: record.a });
    }
    if (record.g) { counts.alreadyMapped += 1; return record; }
    if (!validRings(feature.geometry?.rings)) {
      counts.invalidGeometry += 1;
      review.push({ record: record.i, reason: 'Layer geometry is missing or outside Florida' });
      return record;
    }
    counts.boundariesAdded += 1;
    return { ...record, g: feature.geometry.rings };
  });
  return { records: out, counts, review };
}

// Runs one bounded refresh. Over budget means nothing is requested and nothing is staged.
async function refreshCounty({ dataset, countyCode, fetcher, maxRequests = DEFAULT_MAX_REQUESTS, now = () => new Date() }) {
  const ids = [...new Set(dataset.recs.map(record => statewideId(record.p)).filter(Boolean))];
  const plan = batches(ids);
  const report = {
    dataset: dataset.id, county: dataset.county, state: dataset.state, countyCode,
    layer: LAYER.url, generatedAt: now().toISOString(),
    parcelIds: ids.length, requests: { planned: plan.length, max: maxRequests, used: 0 },
    status: 'incomplete', counts: null, review: [], reviewTotal: 0, gate: null, publication: 'not published',
  };
  if (plan.length > maxRequests) {
    report.status = 'over-budget';
    report.note = 'Raise --max-requests after reviewing the plan. Nothing was requested.';
    return { report, proposed: null };
  }
  const features = [];
  for (const batch of plan) {
    report.requests.used += 1;
    features.push(...await fetcher(queryFor(countyCode, batch)));
  }
  const result = refreshRecords(dataset.recs, features);
  const today = now().toISOString().slice(0, 10);
  const proposed = result.counts.boundariesAdded > 0
    ? { ...dataset, updated: today, recs: result.records,
      outlineSource: { ...dataset.outlineSource, parcels: { ...(dataset.outlineSource?.parcels ?? {}), date: today } } }
    : { ...dataset, recs: result.records };
  const gate = checkMapDataset(proposed, dataset.id + '.json');
  report.gate = { ok: gate.errors.length === 0 && gate.count > 0, errors: gate.errors };
  report.counts = result.counts;
  report.reviewTotal = result.review.length;
  report.review = result.review.slice(0, REVIEW_LIMIT);
  report.status = report.gate.ok ? 'ready-for-review' : 'failed-validation';
  return { report, proposed: report.gate.ok ? proposed : null };
}

function countyCodeFor(datasetId) {
  const key = countyKey(datasetId.replace(/^FL-/, ''));
  const row = registry.counties.find(county => countyKey(county.name) === key);
  return row ? row.sourceCountyValue : null;
}

async function liveFetch(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('Statewide layer HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw Error('Statewide layer error: ' + (data.error.message || 'query failed'));
  if (data.exceededTransferLimit) throw Error('Statewide layer returned a partial batch');
  if (!Array.isArray(data.features)) throw Error('Statewide layer response has no features');
  return data.features;
}

// Offline stand-in for the live layer. Returns only the features a batch's query asks for.
function fixtureFetcher(features) {
  return async url => {
    const where = new URL(url).searchParams.get('where') || '';
    const wanted = new Set([...where.matchAll(/'([^']*)'/g)].map(match => match[1].toUpperCase()));
    return features.filter(feature => wanted.has(statewideId(feature?.attributes?.[LAYER.idField])));
  };
}

async function writeStaged({ outDir, dataset, proposed, report }) {
  const resolved = path.resolve(outDir);
  if (resolved.split(path.sep).join('/').includes('kinvest-liens/map/data')) throw Error('Refusing to write into live map data');
  await fs.mkdir(resolved, { recursive: true });
  await fs.writeFile(path.join(resolved, dataset + '.report.json'), JSON.stringify(report, null, 2) + '\n');
  if (proposed) await fs.writeFile(path.join(resolved, dataset + '.proposed.json'), JSON.stringify(proposed) + '\n');
  return resolved;
}

module.exports = { refreshRecords, refreshCounty, batches, queryFor, validRings, statewideId, streetKey, countyCodeFor, fixtureFetcher, LAYER };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const flag = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
    const datasetId = flag('--dataset');
    if (!datasetId || !/^FL-[a-z-]+$/.test(datasetId)) throw Error('Usage: --dataset FL-<county> (--live | --fixture features.json)');
    const live = args.includes('--live');
    const fixture = flag('--fixture');
    if (!live && !fixture) throw Error('Choose --live (makes requests) or --fixture features.json (offline)');
    const countyCode = countyCodeFor(datasetId);
    if (countyCode === null) throw Error('No Florida county code in the reviewed registry for ' + datasetId);
    const dataset = JSON.parse(await fs.readFile(path.join('kinvest-liens', 'map', 'data', datasetId + '.json'), 'utf8'));
    const maxRequests = Number(flag('--max-requests') ?? DEFAULT_MAX_REQUESTS);
    const fetcher = live ? liveFetch : fixtureFetcher(JSON.parse(await fs.readFile(fixture, 'utf8')));
    const { report, proposed } = await refreshCounty({ dataset, countyCode, fetcher, maxRequests });
    const outDir = await writeStaged({ outDir: flag('--out') ?? DEFAULT_OUT, dataset: datasetId, proposed, report });
    console.log(JSON.stringify({ status: report.status, counts: report.counts, requests: report.requests, gate: report.gate, outDir }, null, 2));
    if (report.status !== 'ready-for-review') process.exitCode = 1;
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
