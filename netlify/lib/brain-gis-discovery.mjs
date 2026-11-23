// Autonomous GIS connector discovery. Owner-triggered, bounded, preview-only.
// Discovery reads public ArcGIS metadata and, for the single best candidate per
// county, up to three sample parcels from the county's own record file. It never
// changes the map and never marks a source Verified without a matched sample parcel.
// Discovery requests use their own daily and per-run budget. They never draw on the
// shared county or Wayne GIS budgets.
import { createCountyConnector, connectorError } from './brain-gis-universal.mjs';

export const DISCOVERY_DAILY_LIMIT = 60;
export const DISCOVERY_RUN_LIMIT = 16;
export const MAX_SERVICE_PROBES = 6;
export const MAX_LAYER_DETAILS = 3;
export const MAX_SAMPLES = 3;
export const MAX_CANDIDATE_CHECKS = 2;
export const BUDGET_KEY_PREFIX = 'brain-gis-discovery-budget-v1-';
const CACHE_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 4_000_000;
const ARCGIS_PORTAL = 'https://www.arcgis.com/sharing/rest/portals/';

// Reviewed seed inputs. The engine only enumerates these roots; it never guesses a host.
// officialHosts and authorityUrl are operator-declared for hosts that do not end in .gov/.us.
export const DISCOVERY_SEEDS = Object.freeze({
 'FL-miami-dade': Object.freeze({ county: 'Miami-Dade', state: 'FL',
  roots: Object.freeze(['https://gisfs.miamidade.gov/mdarcgis/rest/services']),
  authorityUrl: 'https://www.miamidadepa.gov/pa/real-estate/property-search.page' }),
 'CO-larimer': Object.freeze({ county: 'Larimer', state: 'CO',
  roots: Object.freeze(['https://maps1.larimer.org/arcgis/rest/services/MapServices']),
  officialHosts: Object.freeze(['larimer.gov', 'larimer.org']),
  authorityUrl: 'https://www.larimer.gov/assessor' }),
 'FL-palm-beach': Object.freeze({ county: 'Palm Beach', state: 'FL',
  roots: Object.freeze(['https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services']),
  portalOrgId: 'ZWOoUZbtaYePLlPw', portalName: /^palm beach county\b/i }),
});

const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const PARCEL_ORDER = ['folio', 'pcn', 'parcelnumber', 'parcelno', 'parcelnum', 'parcelid', 'parcel', 'strap', 'parid', 'pin', 'apn', 'propid', 'pid', 'taxparcel'];
const isAddress = key => /addr|situs/.test(key) && !/mail|owner|zip/.test(key);
// Source-level failures end the sample check. Record-level misses move on to the next sample.
const SOURCE_LEVEL = /^(http_|transport_or_payload|incomplete_results|unsupported_crs|provider_error|too_large)/;
const BLOCKED_CODE = /^(http_|transport_or_payload|unsupported_schema|provider_error|incomplete_results|too_large)/;

export function serviceScore(name) {
 const n = String(name).toLowerCase();
 let score = /^(?:[a-z]+_)?parcels?$/.test(n) ? 4 : /parcel|cadastr|folio/.test(n) ? 3 : /propert|assess|\bpao\b|(?:^|_)pa(?:_|$)/.test(n) ? 1 : 0;
 if (score && /owned|fema|canopy|surtax|heirs|address|tree|flood|zoning|sites|cba|camp/.test(n)) score -= 3;
 // Detail layers usually carry the situs address that verification needs.
 if (score >= 3 && /detail/.test(n)) score += 1;
 return score;
}

export function evaluateLayer(layer) {
 const fields = Array.isArray(layer?.fields) ? layer.fields.filter(field => typeof field?.name === 'string') : null;
 const strings = (fields ?? []).filter(field => field.type === 'esriFieldTypeString');
 const parcelKey = PARCEL_ORDER.find(key => strings.some(field => norm(field.name) === key));
 const addresses = strings.filter(field => isAddress(norm(field.name)));
 const ref = layer?.extent?.spatialReference ?? layer?.spatialReference ?? null;
 const latest = ref?.latestWkid ?? ref?.wkid ?? null;
 return {
  hasFields: fields !== null,
  polygon: String(layer?.geometryType ?? '').toLowerCase() === 'esrigeometrypolygon',
  parcel: parcelKey ? strings.find(field => norm(field.name) === parcelKey).name : null,
  address: (addresses.find(field => /situs|site/.test(norm(field.name))) ?? addresses[0])?.name ?? null,
  nativeWkid: Number.isSafeInteger(latest) ? latest : null,
  nativeAliases: Number.isSafeInteger(ref?.wkid) && ref.wkid !== latest ? [ref.wkid] : [],
  lastEditDate: Number.isFinite(layer?.editingInfo?.lastEditDate) ? layer.editingInfo.lastEditDate : null,
 };
}

export function currentness(lastEditDate, nowMs) {
 if (!Number.isFinite(lastEditDate)) return 'unknown';
 return nowMs - lastEditDate > STALE_MS ? 'stale' : 'current';
}

// Government authority from the host itself, a seed-declared domain, or the ArcGIS organization name.
// The organization name is published by the organization, so it is labelled as such, not as ownership proof.
export function authorityFor({ host, seed, portal = null }) {
 const h = String(host).toLowerCase();
 if (/\.(gov|us)$/.test(h)) return { status: 'verified', basis: 'government-domain', host: h };
 if ((seed.officialHosts ?? []).some(domain => h === domain || h.endsWith('.' + domain)))
  return { status: 'verified', basis: 'seed-declared-domain', host: h };
 if (seed.portalOrgId && portal?.name && seed.portalName?.test(portal.name))
  return { status: 'verified', basis: 'arcgis-organization-name', host: h, portalName: portal.name };
 return { status: 'unverified', basis: 'no-authority-evidence', host: h };
}

export function paddedBounds(bb, pad = 0.1) {
 if (!Array.isArray(bb) || bb.length !== 4 || !bb.every(Number.isFinite)) return null;
 const [w, s, e, n] = bb;
 return [Math.max(-180, w - pad), Math.max(-90, s - pad), Math.min(180, e + pad), Math.min(90, n + pad)];
}

// ".../rest/services" or ".../rest/services/<folder>" both map to the services root.
export function servicesBase(root) {
 return String(root).replace(/\/rest\/services(\/.*)?$/, '/rest/services');
}

 // Up to `limit` records whose identity and address are unambiguous within the county file.
// Mapped records (geometry already in the county file) come first: their parcels should exist in the
// official layer the map was built from. Unmapped records are the fallback, since they are often absent from it.
export function pickSampleRecords(records, limit = MAX_SAMPLES) {
 const parcels = new Map(), ids = new Map();
 for (const row of records) {
  parcels.set(row?.p, (parcels.get(row?.p) ?? 0) + 1);
  ids.set(row?.i, (ids.get(row?.i) ?? 0) + 1);
 }
 const eligible = records.filter(row => typeof row?.i === 'string' && typeof row?.p === 'string' &&
  /^\s*\d+\s+\S/.test(String(row.a ?? '')) && parcels.get(row.p) === 1 && ids.get(row.i) === 1);
 return [...eligible.filter(row => row.g), ...eligible.filter(row => !row.g)].slice(0, limit);
}

// Dash-stripped form first, matching the reviewed Florida folio and PCN formats; then the recorded form.
export function identifierVariants(parcelId) {
 const raw = String(parcelId);
 return [...new Set([raw.replace(/-/g, ''), raw])].filter(Boolean);
}

export function classify(code) {
 if (String(code ?? '').startsWith('discovery_')) return 'Source Found';
 return BLOCKED_CODE.test(String(code ?? '')) ? 'Blocked' : 'Needs Review';
}

export function createDiscoveryBudget({ storage, now = () => new Date(), dailyLimit = DISCOVERY_DAILY_LIMIT, runLimit = DISCOVERY_RUN_LIMIT } = {}) {
 if (typeof storage?.read !== 'function' || typeof storage?.write !== 'function') throw Error('Discovery budget needs storage');
 let runUsed = 0;
 const today = () => now().toISOString().slice(0, 10);
 return {
  get runUsed() { return runUsed; },
  dailyLimit, runLimit,
  async usage() {
   const day = today();
   const snapshot = await storage.read(BUDGET_KEY_PREFIX + day);
   return { day, used: snapshot?.data?.count ?? 0, dailyLimit, runLimit, runUsed };
  },
  async reserve(countyId, stage) {
   if (runUsed >= runLimit) throw connectorError('discovery_run_budget', 'This discovery run reached its request limit', 'discovery');
   for (let attempt = 0; attempt < 3; attempt++) {
    const day = today(), key = BUDGET_KEY_PREFIX + day;
    const snapshot = await storage.read(key);
    const count = snapshot?.data?.count ?? 0;
    if (count >= dailyLimit) throw connectorError('discovery_budget', 'Daily discovery request limit reached', 'discovery');
    const etag = await storage.write(key, { day, count: count + 1, lastCounty: countyId, lastStage: stage, updatedAt: now().toISOString() }, snapshot?.etag ?? null);
    if (etag) { runUsed += 1; return count + 1; }
   }
   throw connectorError('discovery_budget_unavailable', 'Discovery budget is temporarily unavailable', 'discovery');
  },
 };
}

export function createGisClient({ countyId, budget, fetcher = fetch, now = () => new Date(), timeoutMs = 8000, cache = new Map() }) {
 const ledger = [];
 let cacheHits = 0;
 const locate = url => { const u = new URL(url); return { host: u.host, path: u.pathname }; };
 async function reserve(stage, url) {
  await budget.reserve(countyId, stage);
  ledger.push({ stage, ...locate(url) });
 }
 async function get(url, stage) {
  const hit = cache.get(url);
  if (hit && now().getTime() - hit.at < CACHE_MS) { cacheHits += 1; return hit.data; }
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
   await reserve(stage, url);
   let res;
   try { res = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
   catch { lastError = connectorError('transport_or_payload', 'Source unavailable', 'source'); continue; }
   if (res.status === 429 || res.status >= 500) { lastError = connectorError('http_' + res.status, 'Official source HTTP ' + res.status, 'source'); continue; }
   if (!res.ok) throw connectorError('http_' + res.status, 'Official source HTTP ' + res.status, 'source');
   const raw = await res.text();
   if (Buffer.byteLength(raw) > MAX_BYTES) throw connectorError('too_large', 'Official response too large', 'source');
   let data;
   try { data = JSON.parse(raw); } catch { throw connectorError('transport_or_payload', 'Source response unreadable', 'source'); }
   if (data?.error) throw connectorError('provider_error', 'Official GIS provider error', 'source');
   cache.set(url, { data, at: now().getTime() });
   return data;
  }
  throw lastError;
 }
 function summary() {
  const byStage = {};
  for (const entry of ledger) byStage[entry.stage] = (byStage[entry.stage] ?? 0) + 1;
  return { used: ledger.length, cacheHits, byStage, requests: ledger };
 }
 return { get, reserve, summary };
}

// Runs one bounded discovery pass for a county. Budget exhaustion ends the pass and is reported, never thrown.
export async function discoverCounty({ countyId, dataset = null, records = [], budget, fetcher = fetch, now = () => new Date(), seeds = DISCOVERY_SEEDS, maxServiceProbes = MAX_SERVICE_PROBES, cache = new Map() }) {
 const seed = seeds[countyId];
 if (!seed) throw connectorError('no_seed', 'No reviewed discovery seed for this county', 'discovery');
 const client = createGisClient({ countyId, budget, fetcher, now, cache });
 const observedAt = now().toISOString();
 const notes = [], rejected = [];
 const state = { limited: false };
 const probe = async (url, stage) => {
  if (state.limited) return { error: connectorError('discovery_skipped', 'Skipped after the request limit', 'discovery') };
  try { return { data: await client.get(url, stage) }; }
  catch (error) {
   if (error.scope === 'discovery') state.limited = true;
   return { error };
  }
 };

 // 1. Enumerate the reviewed seed directories (one level).
 const services = [];
 for (const root of seed.roots) {
  const listing = await probe(`${root}?f=json`, 'list-services');
  if (listing.error) { notes.push(`${root}: ${listing.error.code}`); continue; }
  for (const service of listing.data.services ?? []) {
   if (typeof service?.name === 'string' && typeof service?.type === 'string') services.push({ root, name: service.name, type: service.type });
  }
 }
 const ranked = services
  .filter(service => ['MapServer', 'FeatureServer'].includes(service.type) && serviceScore(service.name) > 0)
  .sort((a, b) => serviceScore(b.name) - serviceScore(a.name) || a.name.localeCompare(b.name));
 const probes = ranked.slice(0, maxServiceProbes);
 if (ranked.length > probes.length) notes.push(`${ranked.length - probes.length} lower-ranked services not probed`);

 // 2. Read layer metadata for the top services. Keep only polygon layers with parcel and address fields.
 const found = [];
 let details = 0;
 for (const service of probes) {
  if (state.limited) break;
  // Folder listings already prefix the name with its folder (for example "MapServices/Parcels").
  const base = `${servicesBase(service.root)}/${service.name}/${service.type}`;
  const meta = await probe(`${base}/layers?f=json`, 'probe-layers');
  if (meta.error) { notes.push(`${service.name}: ${meta.error.code}`); continue; }
  for (const entry of meta.data.layers ?? []) {
   if (!Number.isSafeInteger(entry?.id)) continue;
   let layer = entry;
   if (!Array.isArray(entry.fields) && details < MAX_LAYER_DETAILS) {
    details += 1;
    const detail = await probe(`${base}/${entry.id}?f=json`, 'probe-layer');
    if (detail.error) { rejected.push({ service: service.name, layer: entry.id, reason: detail.error.code }); continue; }
    layer = { ...entry, ...detail.data };
   }
   const info = evaluateLayer(layer);
   if (!info.polygon) continue;
   if (!info.parcel || !info.address) {
    const missing = [!info.parcel && 'parcel identifier', !info.address && 'situs address'].filter(Boolean).join(' and ');
   rejected.push({ service: service.name, layer: entry.id, reason: `Polygon layer lacks a ${missing} field` });
    continue;
   }
   found.push({ service, base, layerId: entry.id, layerName: String(layer.name ?? ''), info });
  }
 }

 // 3. Authority per candidate. The ArcGIS organization lookup runs once, and only when the host alone is not enough.
 let portal;
 const candidates = [];
 for (const item of found) {
  const layerUrl = `${item.base}/${item.layerId}`;
  const host = new URL(layerUrl).hostname;
  let authority = authorityFor({ host, seed });
  if (authority.status !== 'verified' && seed.portalOrgId && !state.limited) {
   if (portal === undefined) {
    const lookup = await probe(`${ARCGIS_PORTAL}${seed.portalOrgId}?f=json`, 'portal-owner');
    portal = lookup.data ?? null;
    if (lookup.error) notes.push('ArcGIS organization lookup: ' + lookup.error.code);
   }
   authority = authorityFor({ host, seed, portal });
  }
  const freshness = currentness(item.info.lastEditDate, now().getTime());
  const reasons = [];
  let status = 'Source Found';
  if (authority.status !== 'verified') { status = 'Needs Review'; reasons.push('No government authority evidence for this host'); }
  if (item.info.nativeWkid === null) { status = 'Needs Review'; reasons.push('Layer does not declare a spatial reference'); }
  if (freshness === 'stale') reasons.push('Layer last edited ' + new Date(item.info.lastEditDate).toISOString().slice(0, 10) + '; confirm it is current');
  candidates.push({
   id: `${countyId}|${item.service.name}|${item.layerId}`,
   status, reasons,
   score: serviceScore(item.service.name) + (authority.status === 'verified' ? 2 : 0) + (freshness === 'current' ? 1 : 0),
   service: { name: item.service.name, type: item.service.type, url: item.base },
   layer: { id: item.layerId, name: item.layerName, url: layerUrl },
   fields: { parcel: item.info.parcel, address: item.info.address },
   nativeWkid: item.info.nativeWkid, nativeAliases: item.info.nativeAliases,
   authority,
   authorityUrl: seed.authorityUrl ?? (authority.basis === 'arcgis-organization-name' ? ARCGIS_PORTAL + seed.portalOrgId : `https://${host}/`),
   lastEditDate: Number.isFinite(item.info.lastEditDate) ? new Date(item.info.lastEditDate).toISOString() : null,
   currentness: freshness,
   sample: null,
   observedAt,
  });
 }
 candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

 // 4. Sample checks for the top candidates, in rank order, stopping at the first verified source.
 const samples = pickSampleRecords(records, MAX_SAMPLES);
 const bounds = paddedBounds(dataset?.bb);
 const checkable = candidates.filter(candidate => candidate.status === 'Source Found').slice(0, MAX_CANDIDATE_CHECKS);
 if (checkable.length && (!samples.length || !bounds)) {
  const why = !samples.length
   ? 'No sample parcel with a house-numbered situs address in the county record file'
   : 'No reviewed county bounds for verification';
  for (const candidate of checkable) {
   candidate.status = 'Needs Review';
   candidate.reasons.push(why);
  }
 } else {
  for (const candidate of checkable) {
   if (state.limited) { candidate.reasons.push('Sample check not run: request limit reached'); continue; }
   await sampleCheck(candidate);
   if (candidate.status === 'Verified') break;
  }
 }
 const anyVerified = candidates.some(candidate => candidate.status === 'Verified');
 for (const candidate of candidates) {
  if (candidate.status !== 'Source Found' || candidate.sample || candidate.reasons.some(reason => /Sample check/.test(reason))) continue;
  candidate.reasons.push(anyVerified
   ? 'Not sample-checked: a higher-ranked candidate verified first'
   : `Not sample-checked: only the top ${MAX_CANDIDATE_CHECKS} candidates are checked per pass`);
 }

 async function sampleCheck(candidate) {
  candidate.status = 'Testing';
  const config = {
   id: countyId, county: seed.county, state: seed.state, mode: 'discovery-preview', enabled: false,
   source: candidate.layer.url, authority: candidate.authorityUrl,
   reviewedOrigin: new URL(candidate.layer.url).origin,
   format: candidate.service.type === 'MapServer' ? 'map-server' : 'feature-server',
   nativeWkid: candidate.nativeWkid, nativeAliases: candidate.nativeAliases,
   fields: { parcel: candidate.fields.parcel, address: candidate.fields.address },
   bounds,
  };
  const stop = (error, attempts) => {
   if (error.scope === 'discovery') {
    state.limited = true;
    candidate.status = 'Source Found';
    candidate.reasons.push('Sample check stopped: discovery request limit reached');
    candidate.sample = attempts.length ? { outcome: 'not-matched', attempts, checkedAt: now().toISOString() } : null;
    return;
   }
   candidate.status = classify(error.code);
   candidate.sample = { outcome: 'error', code: error.code, message: error.message, attempts, checkedAt: now().toISOString() };
   candidate.reasons.push(error.message);
  };
  let connector, discovery;
  try {
   connector = createCountyConnector(config, { reserve: (id, stage) => client.reserve(stage, config.source), fetcher, now });
   discovery = await connector.discover();
  } catch (error) { return stop(error, []); }

  const attempts = [];
  let matched = null;
  for (const record of samples) {
   let lastError = null;
   for (const parcelId of identifierVariants(record.p)) {
    try {
     const evidence = await connector.verify({ ...record, dataset: countyId, p: parcelId }, discovery);
     matched = { record, parcelId, evidence };
     break;
    } catch (error) {
     if (error.scope === 'discovery') return stop(error, attempts);
     lastError = error;
     if (error.code !== 'missing') break;
    }
   }
   if (matched) break;
   attempts.push({ recordId: record.i, code: lastError.code });
   if (SOURCE_LEVEL.test(lastError.code)) return stop(lastError, attempts);
  }

  if (!matched) {
   candidate.status = 'Needs Review';
   candidate.sample = { outcome: 'not-matched', attempts, checkedAt: now().toISOString() };
   candidate.reasons.push(`None of ${attempts.length} sample parcels matched this layer`);
   return;
  }
  candidate.sample = {
   outcome: 'matched',
   recordId: matched.record.i,
   identifierForm: matched.parcelId === matched.record.p ? 'as-recorded' : 'dashes-removed',
   attempts: attempts.length + 1,
   checkedAt: now().toISOString(),
   polygon: { acres: Math.round(matched.evidence.geometry.acres * 10000) / 10000, bounds: matched.evidence.geometry.bounds },
  };
  candidate.status = candidate.currentness === 'stale' ? 'Needs Review' : 'Verified';
  candidate.reasons.push(candidate.status === 'Verified'
   ? 'Sample parcel matched the official layer and its situs address'
   : 'Sample matched, but the layer is stale');
 }

 const best = candidates.find(candidate => candidate.status === 'Verified') ?? candidates[0] ?? null;
 const status = best?.status ?? 'Blocked';
 const reason = !best
  ? 'No polygon layer with a parcel identifier and situs address was found in the reviewed seed directories.'
  : best.reasons[0] ?? status;
 return {
  countyId, county: seed.county, state: seed.state, observedAt,
  status, reason, best: best?.id ?? null, candidates, rejected, notes,
  requests: client.summary(),
  daily: await budget.usage(),
  map: { status: 'not-connected', reason: 'Discovery does not change the map. Overlays stay unchanged until an owner approves a verified source and a reviewed overlay correction exists.' },
 };
}

// Owner approval is a record change only. It never sends a GIS request and never activates the map.
export function approveCandidate(result, candidateId, { now = () => new Date() } = {}) {
 const candidate = result?.candidates?.find(item => item.id === candidateId);
 if (!candidate) throw connectorError('unknown_candidate', 'Candidate not found', 'discovery');
 if (candidate.status !== 'Verified' || candidate.authority?.status !== 'verified' ||
   candidate.sample?.outcome !== 'matched' || candidate.currentness === 'stale')
  throw connectorError('not_approvable', 'Only a verified, current source with government authority can be approved', 'discovery');
 return { ...result, owner: { candidateId, approvedAt: now().toISOString(), mapStatus: 'not-connected' } };
}
