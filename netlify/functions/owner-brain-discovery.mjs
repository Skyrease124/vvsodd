// Owner-only, preview-only GIS connector discovery. Discovery never changes the map.
// GET reports stored results and the discovery budget. POST runs one bounded pass for a
// reviewed county (explicit confirmation, owner origin) or records owner approval of a
// verified source (no GIS request).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as auth from '../lib/brain-auth.mjs';
import {
 approveCandidate, createDiscoveryBudget, discoverCounty, DISCOVERY_DAILY_LIMIT, DISCOVERY_RUN_LIMIT, DISCOVERY_SEEDS,
 DISCOVERY_TIME_LIMIT_MS
} from '../lib/brain-gis-discovery.mjs';

const RECORDS = 'brain-gis-discovery-v1';
const LOG = 'brain-gis-discovery-log-v1';
const MAX_LOG = 50;
const storage = { read: auth.kvGetVersioned, write: auth.kvPutVersioned };

const reply = (status, data) => new Response(JSON.stringify(data), {
 status,
 headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Robots-Tag': 'noindex, nofollow' },
});
const root = () => join(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'kinvest-liens', 'map');
const readJson = async path => JSON.parse(await readFile(join(root(), path), 'utf8'));

async function appendLog(event) {
 const events = (await auth.kvGet(LOG)) ?? [];
 await auth.kvPut(LOG, [event, ...events].slice(0, MAX_LOG));
}

async function handler(req, context) {
 if (context?.deploy?.context !== 'deploy-preview' || !auth.isBrainPreview()) return reply(404, { ok: false, error: 'Deploy preview only' });
 if (req.method !== 'GET' && req.method !== 'POST') return reply(405, { ok: false, error: 'GET or POST only' });
 const user = await auth.userFromCookie(req.headers.get('cookie') || '');
 if (!user?.owner) return reply(user ? 403 : 401, { ok: false, error: 'Owner access required' });

 if (req.method === 'GET') {
  const records = (await auth.kvGet(RECORDS)) ?? {};
  const budget = await createDiscoveryBudget({ storage }).usage();
  return reply(200, {
   ok: true, previewOnly: true, mapChanged: false,
   budget: { ...budget, dailyLimit: DISCOVERY_DAILY_LIMIT, runLimit: DISCOVERY_RUN_LIMIT },
   counties: Object.entries(DISCOVERY_SEEDS).map(([id, seed]) => ({ id, county: seed.county, state: seed.state, result: records[id] ?? null })),
   log: ((await auth.kvGet(LOG)) ?? []).slice(0, 20),
  });
 }

 if (req.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { ok: false, error: 'Cross-site request denied' });
 if (req.headers.get('origin') !== new URL(req.url).origin) return reply(403, { ok: false, error: 'Invalid origin' });
 let body;
 try { const raw = await req.text(); if (raw.length > 500) throw Error('too large'); body = JSON.parse(raw); }
 catch { return reply(400, { ok: false, error: 'Invalid request' }); }
 if (body?.confirmed !== true) return reply(400, { ok: false, error: 'Explicit confirmation required' });

 if (body.action === 'discover') {
  if (!Object.hasOwn(DISCOVERY_SEEDS, body.countyId)) return reply(400, { ok: false, error: 'No reviewed discovery seed for this county' });
  const index = await readJson('index.json');
  const dataset = index.datasets.find(row => row.id === body.countyId);
  const county = await readJson('data/' + body.countyId + '.json');
  const budget = createDiscoveryBudget({ storage });
  const result = await discoverCounty({
   countyId: body.countyId, dataset: { bb: dataset?.bb ?? null }, records: county.recs ?? [], budget, fetcher: fetch,
   deadline: Date.now() + DISCOVERY_TIME_LIMIT_MS,
  });
  const records = (await auth.kvGet(RECORDS)) ?? {};
  records[body.countyId] = { ...result, savedAt: new Date().toISOString() };
  await auth.kvPut(RECORDS, records);
  await appendLog({ at: new Date().toISOString(), type: 'gis-discovery', countyId: body.countyId, status: result.status, requests: result.requests.used });
  return reply(200, { ok: true, mapChanged: false, result });
 }

 if (body.action === 'approve-source') {
  const records = (await auth.kvGet(RECORDS)) ?? {};
  const current = records[body.countyId];
  if (!current) return reply(404, { ok: false, error: 'Run discovery for this county first' });
  let approved;
  try { approved = approveCandidate(current, body.candidateId); }
  catch (error) { return reply(409, { ok: false, error: error.message }); }
  records[body.countyId] = { ...approved, savedAt: new Date().toISOString() };
  await auth.kvPut(RECORDS, records);
  await appendLog({ at: new Date().toISOString(), type: 'gis-source-approved', countyId: body.countyId, candidateId: body.candidateId, requests: 0 });
  return reply(200, { ok: true, mapChanged: false, requests: 0, result: records[body.countyId] });
 }

 return reply(400, { ok: false, error: 'Unknown action' });
}

export default auth.withBrainStore(handler);
