// Knowledge index for the AI: our own checked content (state rules, course lessons, source registry) split into
// passages with LlamaIndex (Document + SentenceSplitter) and searched with BM25 (free, no embeddings, no outside calls).
// Each passage keeps where it came from, so every retrieved fact can be cited. The built index is saved in the site database
// (Netlify Blobs) keyed by a content hash, so cold starts load it instead of rebuilding.
import crypto from 'node:crypto';
import { Document, TextNode } from '@llamaindex/core/schema';
import { SentenceSplitter } from '@llamaindex/core/node-parser';
import { BaseRetriever } from '@llamaindex/core/retriever';
import { COURSES } from './curriculum/index.mjs';
import { SOURCES } from './source-registry.mjs';
import { kvGet, kvPut } from './auth.mjs';

const STOP = new Set('a an and are as at be by can do does for from has have how i in is it its of on or that the this to was what when where which who will with you your my me'.split(' '));
export const tokens = s => String(s || '').toLowerCase().replace(/[^a-z0-9$%.\s-]/g, ' ').split(/\s+/).map(w => w.replace(/^[.-]+|[.-]+$/g, '')).filter(w => w.length > 1 && !STOP.has(w));
const clean = s => String(s || '').replace(/\[\[[^\]]*\]\]/g, '').replace(/\{\{[a-z]:[^|}]*\|([^}]*)\}\}/g, '$1').replace(/^[!?]{1,2} /gm, '').replace(/[*#>`_]{1,}/g, ' ').replace(/\s+/g, ' ').trim();

export function docsFrom(data) {
  const docs = [];
  for (const s of data.STATES) {
    const text = `${s.n} tax sale system: ${s.sys}. Interest or penalty: ${s.rate}. Redemption: ${s.red}. Bidding: ${s.bid}. ${s.note || ''}` + (s.v ? ' Sources differ for this state; verify with the county.' : '');
    docs.push(new Document({ text, metadata: { kind: 'state-rules', state: s.a, title: s.n + ' tax sale rules', url: '/liens/states/state/?s=' + s.a, verify: !!s.v } }));
  }
  for (const c of Object.values(COURSES)) {
    for (const m of c.modules) for (const l of m.lessons) {
      docs.push(new Document({ text: l.title + '. ' + clean(l.body), metadata: { kind: 'course', state: c.state, title: c.state + ' course: ' + l.title, url: '/learn/course/?c=' + c.id, checked: c.checked } }));
    }
  }
  for (const s of SOURCES) docs.push(new Document({ text: `${s.name} (${s.owner}). Covers: ${s.coverage}. Access: ${s.access}. Reliability: ${s.reliability}. Updates: ${s.update}. Limits: ${s.limits}`, metadata: { kind: 'source', title: s.name, url: s.url, integrated: s.integrated } }));
  return docs;
}

export function buildIndex(data) {
  const nodes = new SentenceSplitter({ chunkSize: 220, chunkOverlap: 30 }).getNodesFromDocuments(docsFrom(data));
  const passages = nodes.map((n, i) => ({ id: i, text: n.getContent ? n.getContent('NONE') : n.text, meta: n.metadata }));
  return finish(passages);
}
function finish(passages) {
  const df = Object.create(null), tf = []; let total = 0;
  for (const p of passages) { const t = tokens(p.text), f = Object.create(null); for (const w of t) f[w] = (f[w] || 0) + 1; for (const w in f) df[w] = (df[w] || 0) + 1; tf.push({ f, len: t.length }); total += t.length; }
  return { passages, tf, df, avg: total / Math.max(1, passages.length), N: passages.length };
}
// Search. opts.state limits to one state (state-neutral passages such as sources always allowed); opts.kinds filters by kind.
export function search(idx, query, opts = {}) {
  const q = [...new Set(tokens(query))], k1 = 1.4, b = 0.75, out = [];
  idx.passages.forEach((p, i) => {
    if (opts.state && p.meta.state && p.meta.state !== opts.state) return;
    if (opts.kinds && !opts.kinds.includes(p.meta.kind)) return;
    let s = 0; const { f, len } = idx.tf[i];
    for (const w of q) { const n = f[w]; if (!n) continue; const idf = Math.log(1 + (idx.N - idx.df[w] + .5) / (idx.df[w] + .5)); s += idf * (n * (k1 + 1)) / (n + k1 * (1 - b + b * len / idx.avg)); }
    if (s > 0) out.push({ score: s, text: p.text, meta: p.meta });
  });
  return out.sort((a, b2) => b2.score - a.score).slice(0, opts.k || 5);
}
// LlamaIndex retriever interface, so the index plugs into LlamaIndex query engines later.
export class Bm25Retriever extends BaseRetriever {
  constructor(idx, opts = {}) { super(); this.idx = idx; this.opts = opts; }
  async _retrieve(q) { const query = typeof q === 'string' ? q : (q.query || q); return search(this.idx, typeof query === 'string' ? query : String(query), this.opts).map(r => ({ node: new TextNode({ text: r.text, metadata: r.meta }), score: r.score })); }
}

// Load: memory, then database (keyed by content hash), else build and save.
let MEM = null;
export async function getIndex(data) {
  if (MEM) return MEM;
  const docs = docsFrom(data), hash = crypto.createHash('sha256').update(docs.map(d => d.text).join('\u0001')).digest('hex').slice(0, 16), key = 'kb:index:' + hash;
  let hit = null; try { hit = await kvGet(key); } catch (e) {}
  if (hit && hit.passages) { hit.df = hit.df || {}; MEM = Object.assign(hit, { hash, from: 'database' }); return MEM; }
  MEM = Object.assign(buildIndex(data), { hash, from: 'built' });
  try { await kvPut(key, { passages: MEM.passages, tf: MEM.tf, df: MEM.df, avg: MEM.avg, N: MEM.N }); } catch (e) {}
  return MEM;
}
export const _reset = () => { MEM = null; };
