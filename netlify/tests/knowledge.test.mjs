import assert from 'node:assert/strict'; import { _loadData } from '../functions/ask.mjs'; import { buildIndex, search, Bm25Retriever } from '../lib/knowledge.mjs';
const t0 = Date.now(); const idx = buildIndex(_loadData()); const ms = Date.now() - t0;
console.log('passages', idx.N, 'build ms', ms);
let r = search(idx, 'How long is the redemption period in Florida?', { state: 'FL', k: 3 }); assert(r.length && r[0].meta.state === 'FL', 'FL passage first');
r = search(idx, 'Arizona tax lien interest rate', { k: 3 }); assert(r.some(x => x.meta.state === 'AZ'), 'AZ found');
r = search(idx, 'qzxv nonsense wordzz'); assert.equal(r.length, 0, 'no match returns nothing');
const rr = await new Bm25Retriever(idx, { k: 2 }).retrieve({ query: 'Texas redemption period' }); assert(rr.length && rr[0].node.metadata.url, 'llamaindex retriever returns cited nodes');
console.log('knowledge ok');
