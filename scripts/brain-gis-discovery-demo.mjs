// Bounded, manually started discovery demo against real official GIS services.
// Local only: not deployed, not scheduled. Usage:
//   node scripts/brain-gis-discovery-demo.mjs <evidence-output.json> FL-miami-dade CO-larimer FL-palm-beach
// Every request is counted against a discovery budget. Shared county and Wayne budgets are never touched.
import { readFile, writeFile } from 'node:fs/promises';
import { createDiscoveryBudget, discoverCounty, DISCOVERY_SEEDS } from '../netlify/lib/brain-gis-discovery.mjs';

const [, , outPath, ...countyIds] = process.argv;
if (!outPath || countyIds.length === 0) {
 console.error('Usage: node scripts/brain-gis-discovery-demo.mjs <out.json> <countyId>...');
 process.exit(2);
}
for (const id of countyIds) if (!DISCOVERY_SEEDS[id]) throw Error('No reviewed seed for ' + id);

const root = new URL('../kinvest-liens/map/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', root), 'utf8'));

// Budget ledger kept beside the evidence file, so the daily cap applies across separate runs.
// A production run uses the shared budget store instead.
const ledgerPath = outPath.replace(/[^/]*$/, 'discovery-ledger.json');
async function fileStorage(path) {
 const load = async () => { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return { version: 0, entries: {} }; } };
 return {
  async read(key) { const state = await load(); const e = state.entries[key]; return e ? { data: e.data, etag: String(e.version) } : null; },
  async write(key, data, etag) {
   const state = await load();
   const current = state.entries[key];
   if ((current ? String(current.version) : null) !== etag) return null;
   state.version += 1;
   state.entries[key] = { data, version: state.version };
   await writeFile(path, JSON.stringify(state, null, 2));
   return String(state.version);
  },
 };
}
const storage = await fileStorage(ledgerPath);
const results = [];
for (const countyId of countyIds) {
 const dataset = index.datasets.find(row => row.id === countyId);
 const raw = JSON.parse(await readFile(new URL('data/' + countyId + '.json', root), 'utf8'));
 const started = Date.now();
 const budget = createDiscoveryBudget({ storage });
 const result = await discoverCounty({
  countyId,
  dataset: { bb: dataset?.bb ?? null },
  records: raw.recs ?? [],
  budget,
  fetcher: fetch,
 });
 results.push({ ...result, elapsedMs: Date.now() - started, datasetRecords: raw.recs?.length ?? 0 });
 console.log(`${countyId}: ${result.status} · ${result.requests.used} requests · ${result.candidates.length} candidate(s)`);
}
await writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), counties: results }, null, 2));
console.log('Wrote ' + outPath);
