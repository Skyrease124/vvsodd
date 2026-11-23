import test from 'node:test';
import assert from 'node:assert/strict';
import {
 authorityFor, approveCandidate, createDiscoveryBudget, discoverCounty, evaluateLayer,
 identifierVariants, paddedBounds, pickSampleRecords, serviceScore, currentness
} from '../lib/brain-gis-discovery.mjs';

const NOW = new Date('2026-11-23T12:00:00Z');
const GOV = 'https://gis.example.gov/arcgis/rest/services';
const COUNTY = 'XX-testy';
const SEEDS = Object.freeze({ [COUNTY]: { county: 'Testy', state: 'XX', roots: [GOV] } });
const DATASET = { bb: [-80.5, 25.5, -80.1, 25.9] };
const RECORD = { i: 'XX|Testy|30-2205-000-0200|1', p: '30-2205-000-0200', a: '123 Main St, Testville' };
const RING = [[-80.3, 25.7], [-80.299, 25.7], [-80.299, 25.701], [-80.3, 25.701], [-80.3, 25.7]];

function memoryStorage() {
 const map = new Map();
 let n = 0;
 return {
  map,
  async read(key) { const e = map.get(key); return e ? { data: structuredClone(e.data), etag: e.etag } : null; },
  async write(key, data, etag) {
   const current = map.get(key);
   if ((current?.etag ?? null) !== etag) return null;
   const next = 'e' + (++n);
   map.set(key, { data: structuredClone(data), etag: next });
   return next;
  },
 };
}

// Routes ArcGIS-shaped responses by URL. A route value is { status, body }.
function transport(routes, { query = null } = {}) {
 const calls = [];
 const fetcher = async url => {
  const key = String(url);
  calls.push(key);
  if (key.includes('/query?')) {
   const body = query ? query(key) : { features: [], spatialReference: { wkid: 4326 } };
   return new Response(JSON.stringify(body), { status: 200 });
  }
  const route = routes[key];
  if (!route) return new Response('missing', { status: 404 });
  if (typeof route === 'function') return route();
  return new Response(JSON.stringify(route.body ?? route), { status: route.status ?? 200 });
 };
 return { fetcher, calls };
}

function govRoutes(layerOverrides = {}) {
 const layer0 = {
  id: 0, name: 'Parcels', geometryType: 'esriGeometryPolygon',
  fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }],
  extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } },
  editingInfo: { lastEditDate: NOW.getTime() - 86400000 },
  ...layerOverrides,
 };
 return {
  [`${GOV}?f=json`]: { services: [{ name: 'Parcels', type: 'MapServer' }, { name: 'Owned Parcels', type: 'MapServer' }] },
  [`${GOV}/Parcels/MapServer/layers?f=json`]: { layers: [layer0, { id: 1, name: 'Points', geometryType: 'esriGeometryPoint', fields: [] }] },
  [`${GOV}/Parcels/MapServer/0?f=json`]: {
   geometryType: 'esriGeometryPolygon', capabilities: 'Map,Query', maxRecordCount: 1000,
   fields: layer0.fields, extent: layer0.extent,
  },
 };
}

const matchingQuery = () => ({ features: [{ attributes: { FOLIO: '3022050000200', SITE_ADDR: '123 MAIN ST' }, geometry: { rings: [RING] } }], spatialReference: { wkid: 4326 } });

function budgetFor(storage, opts = {}) {
 return createDiscoveryBudget({ storage, now: () => NOW, ...opts });
}

test('budget enforces the per-run limit and persists the daily count across instances', async () => {
 const storage = memoryStorage();
 const first = budgetFor(storage, { runLimit: 2, dailyLimit: 3 });
 await first.reserve(COUNTY, 'schema');
 await first.reserve(COUNTY, 'schema');
 await assert.rejects(first.reserve(COUNTY, 'schema'), { code: 'discovery_run_budget', scope: 'discovery' });
 const second = budgetFor(storage, { runLimit: 5, dailyLimit: 3 });
 await second.reserve(COUNTY, 'schema');
 await assert.rejects(second.reserve(COUNTY, 'schema'), { code: 'discovery_budget' });
 assert.equal((await second.usage()).used, 3);
});

test('budget retries a lost write once and counts only successful reservations', async () => {
 const storage = memoryStorage();
 const write = storage.write;
 let failed = false;
 storage.write = async (...args) => { if (!failed) { failed = true; return null; } return write(...args); };
 const budget = budgetFor(storage);
 assert.equal(await budget.reserve(COUNTY, 'schema'), 1);
 assert.equal(budget.runUsed, 1);
});

test('client retries one transient failure, counts both attempts, and does not retry a 404', async () => {
 let attempts = 0;
 const routes = {
  [`${GOV}?f=json`]: () => { attempts += 1; return attempts === 1 ? new Response('busy', { status: 503 }) : new Response(JSON.stringify({ services: [] }), { status: 200 }); },
  [`${GOV}/Gone?f=json`]: () => new Response('gone', { status: 404 }),
 };
 const { fetcher } = transport(routes);
 const storage = memoryStorage();
 const budget = budgetFor(storage);
 const result = await discoverCounty({ countyId: COUNTY, budget, fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.requests.byStage['list-services'], 2, 'transient 503 is retried once');
 assert.equal(result.status, 'Blocked');
 const direct = await discoverCounty({ countyId: COUNTY, budget, fetcher: transport(routes).fetcher, now: () => NOW, seeds: { [COUNTY]: { county: 'Testy', state: 'XX', roots: [GOV + '/Gone'] } } });
 assert.equal(direct.requests.used, 1, '404 is not retried');
 assert.match(direct.notes[0], /http_404/);
});

test('authority needs a government host, a reviewed seed domain, or a matching organization name', () => {
 assert.equal(authorityFor({ host: 'gis.example.gov', seed: {} }).status, 'verified');
 assert.equal(authorityFor({ host: 'maps.example.org', seed: {} }).status, 'unverified');
 assert.equal(authorityFor({ host: 'maps.larimer.org', seed: { officialHosts: ['larimer.org'] } }).basis, 'seed-declared-domain');
 const seed = { portalOrgId: 'ORG', portalName: /^palm beach county\b/i };
 assert.equal(authorityFor({ host: 'services1.arcgis.com', seed, portal: { name: 'Palm Beach County GIS' } }).basis, 'arcgis-organization-name');
 assert.equal(authorityFor({ host: 'services1.arcgis.com', seed, portal: { name: 'Some Consulting LLC' } }).status, 'unverified');
});

test('service and layer triage keep parcel polygons and reject the rest', () => {
 assert.equal(serviceScore('PBC_Parcels') > 0, true);
 assert.equal(serviceScore('Palm Beach County Owned Parcels'), 0);
 assert.equal(serviceScore('Parcels_FEMA'), 0);
 assert.equal(serviceScore('MD_PA_PropertySearch') > 0, true);
 const layer = evaluateLayer({ geometryType: 'esriGeometryPolygon', fields: [{ name: 'PCN', type: 'esriFieldTypeString' }, { name: 'SITUS_ADDRESS', type: 'esriFieldTypeString' }, { name: 'OWNER_ADDR', type: 'esriFieldTypeString' }] });
 assert.equal(layer.parcel, 'PCN');
 assert.equal(layer.address, 'SITUS_ADDRESS');
 assert.equal(evaluateLayer({ geometryType: 'esriGeometryPoint', fields: [] }).polygon, false);
 assert.equal(currentness(null, NOW.getTime()), 'unknown');
 assert.equal(currentness(NOW.getTime() - 5 * 365 * 86400000, NOW.getTime()), 'stale');
});

test('sample selection and identifier forms are deterministic', () => {
 assert.deepEqual(identifierVariants('30-2205-000-0200'), ['3022050000200', '30-2205-000-0200']);
 assert.deepEqual(identifierVariants('9524325120'), ['9524325120']);
 const picked = pickSampleRecords([{ i: 'a', p: '1', a: 'Unincorporated County' }, { i: 'b', p: '2', a: '44 Oak Rd' }, { i: 'e', p: '4', a: '9 Pine' }, { i: 'f', p: '5', a: '10 Birch' }]);
 assert.deepEqual(picked.map(row => row.i), ['b', 'e', 'f'], 'at most three eligible samples, in file order');
 assert.deepEqual(pickSampleRecords([{ i: 'c', p: '3', a: '5 Elm' }, { i: 'd', p: '3', a: '6 Elm' }]), []);
 const mapped = pickSampleRecords([{ i: 'u', p: '7', a: '1 Unmapped Rd' }, { i: 'm', p: '8', a: '2 Mapped Rd', g: [[[0, 0]]] }]);
 assert.deepEqual(mapped.map(row => row.i), ['m', 'u'], 'mapped records are sampled first');
 assert.deepEqual(paddedBounds([-80.5, 25.5, -80.1, 25.9]).map(v => Math.round(v * 10) / 10), [-80.6, 25.4, -80, 26]);
});

test('a matched sample verifies the source with counted, bounded requests', async () => {
 const { fetcher, calls } = transport(govRoutes(), { query: matchingQuery });
 const storage = memoryStorage();
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(storage), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Verified');
 const [candidate] = result.candidates;
 assert.equal(candidate.sample.outcome, 'matched');
 assert.equal(candidate.sample.identifierForm, 'dashes-removed');
 assert.equal(candidate.authority.status, 'verified');
 assert.equal(result.requests.used, 4, 'list, layers, schema, one query');
 assert.equal(result.requests.used, calls.length);
 assert.equal(result.map.status, 'not-connected');
 assert.equal(result.daily.used, 4);
});

test('a layer that returns no matching parcel is Needs Review, never Verified', async () => {
 const { fetcher } = transport(govRoutes(), { query: () => ({ features: [], spatialReference: { wkid: 4326 } }) });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Needs Review');
 assert.equal(result.candidates[0].sample.outcome, 'not-matched');
 assert.equal(result.candidates[0].sample.attempts.length, 1);
 assert.equal(result.candidates[0].sample.attempts[0].code, 'missing');
});

test('a single missed sample does not sink a layer: a later sample can verify it', async () => {
 const second = { i: 'XX|Testy|3022050000300|2', p: '3022050000300', a: '125 Main St, Testville' };
 const { fetcher } = transport(govRoutes(), {
  query: url => {
   const folio = decodeURIComponent(url.replace(/\+/g, ' ')).match(/FOLIO = '(\d+)'/)?.[1];
   const features = folio === '3022050000300'
    ? [{ attributes: { FOLIO: folio, SITE_ADDR: '125 MAIN ST' }, geometry: { rings: [RING] } }]
    : [];
   return { features, spatialReference: { wkid: 4326 } };
  },
 });
 const records = [RECORD, { ...second, p: '30-2205-000-0300' }];
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records });
 assert.equal(result.status, 'Verified');
 assert.equal(result.candidates[0].sample.recordId, second.i);
 assert.equal(result.candidates[0].sample.attempts, 2);
});

test('a second candidate that was never sample-checked says so', async () => {
 const routes = govRoutes();
 routes[`${GOV}?f=json`] = { services: [{ name: 'Parcels', type: 'MapServer' }, { name: 'PARCEL_DETAILS', type: 'MapServer' }] };
 routes[`${GOV}/PARCEL_DETAILS/MapServer/layers?f=json`] = { layers: [{ id: 0, name: 'Details', geometryType: 'esriGeometryPolygon', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } } }] };
 const { fetcher } = transport(routes, { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.candidates.length, 2);
 assert.equal(result.candidates[1].sample, null);
 assert.equal(result.candidates[1].status, 'Source Found');
 assert.match(result.candidates[1].reasons.at(-1), /Not sample-checked/);
});

test('a stale layer is never approved, even with a matched sample', async () => {
 const stale = govRoutes({ editingInfo: { lastEditDate: NOW.getTime() - 6 * 365 * 86400000 } });
 const { fetcher } = transport(stale, { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Needs Review');
 assert.equal(result.candidates[0].currentness, 'stale');
 assert.throws(() => approveCandidate(result, result.candidates[0].id), { code: 'not_approvable' });
});

test('an unverified host is Needs Review and makes no sample request', async () => {
 const seeds = { [COUNTY]: { county: 'Testy', state: 'XX', roots: ['https://gis.example.com/arcgis/rest/services'] } };
 const routes = {
  'https://gis.example.com/arcgis/rest/services?f=json': { services: [{ name: 'Parcels', type: 'MapServer' }] },
  'https://gis.example.com/arcgis/rest/services/Parcels/MapServer/layers?f=json': { layers: [{ id: 0, name: 'Parcels', geometryType: 'esriGeometryPolygon', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }] }] },
 };
 const { fetcher, calls } = transport(routes, { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Needs Review');
 assert.equal(calls.some(url => url.includes('/query?')), false);
 assert.match(result.candidates[0].reasons[0], /No government authority/);
});

test('an ArcGIS organization name can establish authority for a non-government host', async () => {
 const seeds = { [COUNTY]: { county: 'Testy', state: 'XX', roots: ['https://services.example.com/arcgis/rest/services'], portalOrgId: 'ORG1', portalName: /^testy county\b/i } };
 const routes = {
  'https://services.example.com/arcgis/rest/services?f=json': { services: [{ name: 'Parcels', type: 'FeatureServer' }] },
  'https://services.example.com/arcgis/rest/services/Parcels/FeatureServer/layers?f=json': { layers: [{ id: 0, name: 'Parcels', geometryType: 'esriGeometryPolygon', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 4326 } } }] },
  'https://services.example.com/arcgis/rest/services/Parcels/FeatureServer/0?f=json': { geometryType: 'esriGeometryPolygon', capabilities: 'Query', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 4326 } } },
  'https://www.arcgis.com/sharing/rest/portals/ORG1?f=json': { name: 'Testy County GIS' },
 };
 const { fetcher } = transport(routes, { query: () => ({ features: [{ attributes: { FOLIO: '3022050000200', SITE_ADDR: '123 MAIN ST' }, geometry: { rings: [RING] } }], spatialReference: { wkid: 4326 } }) });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds, dataset: DATASET, records: [RECORD] });
 assert.equal(result.candidates[0].authority.basis, 'arcgis-organization-name');
 assert.equal(result.status, 'Verified');
});

test('a run that hits its request limit stops cleanly and says so', async () => {
 const { fetcher } = transport(govRoutes(), { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage(), { runLimit: 3 }), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Source Found');
 assert.match(result.candidates[0].reasons.at(-1), /request limit/);
 assert.equal(result.requests.used, 3);
});

test('a folder listing prefixes service names with their folder, and the layer request uses the services root', async () => {
 const root = GOV + '/MapServices';
 const seeds = { [COUNTY]: { county: 'Testy', state: 'XX', roots: [root] } };
 const routes = {
  [`${root}?f=json`]: { services: [{ name: 'MapServices/Parcels', type: 'MapServer' }] },
  [`${GOV}/MapServices/Parcels/MapServer/layers?f=json`]: { layers: [{ id: 0, name: 'Parcels', geometryType: 'esriGeometryPolygon', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } } }] },
  [`${GOV}/MapServices/Parcels/MapServer/0?f=json`]: { geometryType: 'esriGeometryPolygon', capabilities: 'Query', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } } },
 };
 const { fetcher, calls } = transport(routes, { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds, dataset: DATASET, records: [RECORD] });
 assert.equal(calls.some(url => url.startsWith(`${GOV}/MapServices/Parcels/MapServer/layers`)), true);
 assert.equal(calls.some(url => url.includes('/MapServices/MapServices/')), false, 'no doubled folder');
 assert.equal(result.status, 'Verified');
});

test('when the top candidate does not match, the next candidate is checked and can verify the county', async () => {
 const routes = govRoutes();
 routes[`${GOV}?f=json`] = { services: [{ name: 'Parcels', type: 'MapServer' }, { name: 'Parcel_Info', type: 'MapServer' }] };
 routes[`${GOV}/Parcel_Info/MapServer/layers?f=json`] = { layers: [{ id: 0, name: 'Info', geometryType: 'esriGeometryPolygon', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } } }] };
 routes[`${GOV}/Parcel_Info/MapServer/0?f=json`] = { geometryType: 'esriGeometryPolygon', capabilities: 'Query', fields: [{ name: 'FOLIO', type: 'esriFieldTypeString' }, { name: 'SITE_ADDR', type: 'esriFieldTypeString' }], extent: { spatialReference: { wkid: 2236, latestWkid: 2236 } } };
 const { fetcher } = transport(routes, {
  query: url => (url.includes('/Parcel_Info/') ? matchingQuery() : { features: [], spatialReference: { wkid: 4326 } }),
 });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 assert.equal(result.status, 'Verified');
 assert.equal(result.best, COUNTY + '|Parcel_Info|0');
 const [first, second] = result.candidates;
 assert.equal(first.status, 'Needs Review');
 assert.equal(first.sample.outcome, 'not-matched');
 assert.equal(second.sample.outcome, 'matched');
});

test('a time limit ends the pass cleanly, keeps the requests already made, and says so', async () => {
 let clock = NOW.getTime();
 const { fetcher } = transport(govRoutes(), { query: matchingQuery });
 const slow = async (url, options) => { clock += 5000; return fetcher(url, options); };
 const result = await discoverCounty({
  countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher: slow, now: () => new Date(clock),
  seeds: SEEDS, dataset: DATASET, records: [RECORD], deadline: NOW.getTime() + 12000,
 });
 assert.notEqual(result.status, 'Verified');
 assert.match(result.stopped, /Time limit reached/);
 assert.equal(result.requests.used, 3, 'list, layers, schema; the verification request was never sent');
 assert.match(result.candidates[0].reasons.at(-1), /Time limit reached/);
});

test('approval is a record change: it needs a verified, current, authoritative candidate and makes no request', async () => {
 const { fetcher, calls } = transport(govRoutes(), { query: matchingQuery });
 const result = await discoverCounty({ countyId: COUNTY, budget: budgetFor(memoryStorage()), fetcher, now: () => NOW, seeds: SEEDS, dataset: DATASET, records: [RECORD] });
 const before = calls.length;
 const approved = approveCandidate(result, result.candidates[0].id, { now: () => NOW });
 assert.equal(calls.length, before);
 assert.equal(approved.owner.mapStatus, 'not-connected');
 assert.throws(() => approveCandidate(result, 'missing-id'), { code: 'unknown_candidate' });
 const notVerified = { ...result, candidates: [{ ...result.candidates[0], status: 'Needs Review' }] };
 assert.throws(() => approveCandidate(notVerified, notVerified.candidates[0].id), { code: 'not_approvable' });
});
