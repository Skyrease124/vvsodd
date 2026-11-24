#!/usr/bin/env node
// Matches a dataset's parcels to official GIS parcel records and writes the audit document that the owner
// dashboard imports. Free public ArcGIS layers only; no keys, no paid services, no AI.
//
//   node tools/parcel-match/run.mjs [--dataset NY-city-of-rochester] [--offline]
//
// Raw responses are cached under tools/parcel-match/cache (not committed), so a rerun with --offline makes no
// network requests. Output: netlify/lib/data/parcel-matches/<dataset>.json (read only by the owner endpoints).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {matchDataset, indexFeatures, normSbl, leadingSbl} from '../../netlify/lib/parcel-match.mjs';
import {sourcesFor, ADDRESS_ARTIFACT_FIXES} from '../../netlify/lib/gis-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = path.join(ROOT, 'tools', 'parcel-match', 'cache');
const OUT_DIR = path.join(ROOT, 'netlify', 'lib', 'data', 'parcel-matches');
const CHUNK = 40;   // identifiers per query: small requests, well inside the services' limits

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const datasetId = option('--dataset', 'NY-city-of-rochester');
const offline = flag('--offline');

async function queryChunk(src, parcels) {
  const body = new URLSearchParams({
    where: src.parcelField + ' IN (' + parcels.map(p => "'" + p.replace(/'/g, "''") + "'").join(',') + ')',
    outFields: '*', returnGeometry: 'true', outSR: '4326', f: 'json',
  });
  const response = await fetch(src.layerUrl + '/query', {method: 'POST', body, signal: AbortSignal.timeout(60000),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}});
  if (!response.ok) throw new Error(src.id + ' answered HTTP ' + response.status);
  const json = await response.json();
  if (json.error) throw new Error(src.id + ' error: ' + (json.error.message || json.error.code));
  return json;
}

async function featuresFor(src, parcels, dataset) {
  const features = [];
  let retrievedAt = null;
  const dir = path.join(CACHE, src.id);
  fs.mkdirSync(dir, {recursive: true});
  for (let i = 0; i * CHUNK < parcels.length; i++) {
    const slice = parcels.slice(i * CHUNK, (i + 1) * CHUNK);
    const file = path.join(dir, dataset + '-' + String(i).padStart(3, '0') + '.json');
    let cached = null;
    if (fs.existsSync(file)) cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!cached) {
      if (offline) throw new Error('no cached response for ' + src.id + ' chunk ' + i + ' (run once without --offline)');
      const json = await queryChunk(src, slice);
      cached = {retrievedAt: new Date().toISOString(), requested: slice, response: json};
      fs.writeFileSync(file, JSON.stringify(cached));
    }
    retrievedAt = retrievedAt && retrievedAt < cached.retrievedAt ? retrievedAt : cached.retrievedAt;
    features.push(...(cached.response.features || []));
  }
  return {features, retrievedAt};
}

async function main() {
  const datasetFile = path.join(ROOT, 'kinvest-liens', 'map', 'data', datasetId + '.json');
  const dataset = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));
  // A known artifact of the list import is reversed for comparison only. Each change is recorded per record.
  const fixes = ADDRESS_ARTIFACT_FIXES[datasetId] || [];
  const records = dataset.recs.map(r => {
    let address = r.a || null, listedAs = null;
    for (const f of fixes) if (address && f.pattern.test(address)) { listedAs = address; address = address.replace(f.pattern, f.to); }
    return {parcel: r.p, address, listedAs, amount: r.amt ?? null, acreage: r.ac ?? null, category: r.c || null};
  });
  // Identifiers are queried exactly as the City list and the official layer write them.
  const parcels = [...new Set(records.map(r => r.parcel).filter(Boolean))];
  const sources = sourcesFor(dataset.state, dataset.county);
  if (!sources.length) throw new Error('no official parcel source is configured for ' + dataset.county + ', ' + dataset.state);

  const runtime = [], metadata = [];
  for (const src of sources) {
    const {features, retrievedAt} = await featuresFor(src, parcels, datasetId);
    const indexed = indexFeatures(src, features);
    const found = new Set([...indexed.byParcel.keys()]);
    const requestedKeys = new Set(parcels.map(normSbl).filter(Boolean));
    const inThisSource = [...requestedKeys].filter(k => found.has(k)).length;
    runtime.push({id: src.id, parcelField: src.parcelField, bbox: src.bbox, byParcel: indexed.byParcel,
      toAddress: src.toAddress, official: src.official, evidence: src.evidence});
    metadata.push({id: src.id, label: src.label, layerUrl: src.layerUrl, itemUrl: src.itemUrl, dataDate: src.dataDate,
      itemModified: src.itemModified, retrievedAt, terms: src.terms, disclaimer: src.disclaimer,
      coverage: {requested: requestedKeys.size, foundParcelNumbers: inThisSource, features: features.length}});
  }

  const result = matchDataset({dataset: {id: datasetId, state: dataset.state, county: dataset.county}, records, sources: runtime});
  // Keep the owner-facing fields with each record (order is preserved by matchDataset).
  result.records.forEach((r, i) => Object.assign(r, {amount: records[i].amount, acreage: records[i].acreage, category: records[i].category,
    addressAsListed: records[i].listedAs}));
  const output = {...result, generatedAt: new Date().toISOString(), sources: metadata};
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const out = path.join(OUT_DIR, datasetId + '.json');
  fs.writeFileSync(out, JSON.stringify(output, null, 1) + '\n');

  // Leads for investigation only: official parcels at the same street address for records that did not match.
  // A candidate is never treated as a match; it is shown to the owner with the pending record.
  const primary = runtime[0] && sources[0];
  if (primary) {
    const dir = path.join(CACHE, primary.id);
    for (const r of output.records) {
      if (r.status === 'matched' || r.reason !== 'sbl_not_found' || !r.address) continue;
      const num = (r.address.match(/^(\d+)/) || [])[1];
      const word = (r.address.replace(/^\d+(-\d+)?\s+/, '').split(/[ ,]/)[0] || '').toUpperCase();
      if (!num || !word) continue;
      const file = path.join(dir, 'candidates-' + num + '-' + word + '.json');
      let cached = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      if (!cached) {
        if (offline) { r.candidates = []; continue; }
        const body = new URLSearchParams({where: "UPPER(SITEADDRESS) LIKE '" + num + " " + word + "%'", outFields: 'PRINTKEY,SITEADDRESS,ZIP5',
          returnGeometry: 'false', f: 'json'});
        const json = await (await fetch(primary.layerUrl + '/query', {method: 'POST', body, signal: AbortSignal.timeout(60000),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}})).json();
        if (json.error) throw new Error(primary.id + ' candidate query: ' + (json.error.message || json.error.code));
        cached = {retrievedAt: new Date().toISOString(), response: json};
        fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(file, JSON.stringify(cached));
      }
      r.candidates = (cached.response.features || []).map(x => ({printKey: x.attributes.PRINTKEY, siteAddress: x.attributes.SITEADDRESS, zip: x.attributes.ZIP5 || null}));
    }
    // Re-write so the candidate leads are part of the audit document.
    fs.writeFileSync(path.join(OUT_DIR, datasetId + '.json'), JSON.stringify({...output}, null, 1) + '\n');
  }

  const s = output.summary;
  console.log('dataset', datasetId, '| records', s.records);
  for (const m of metadata) console.log('source', m.id, '| parcel numbers found', m.coverage.foundParcelNumbers, 'of', m.coverage.requested, '| data date', m.dataDate);
  console.log('matched', s.matched, '(boundary', s.matchedWithBoundary + ', point only', s.matchedPointOnly + ') | pending', s.pending);
  console.log('by reason', JSON.stringify(s.byReason));
  console.log('wrote', path.relative(ROOT, out));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
