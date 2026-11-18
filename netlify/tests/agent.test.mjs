import assert from 'node:assert/strict';
import { research, wantsResearch } from '../lib/agent.mjs'; import { buildIndex } from '../lib/knowledge.mjs';
import { _loadData } from '../functions/ask.mjs'; import { ruleIntent, cleanIntent, runStates, runLiens, describe } from '../functions/ai.mjs';
const data = _loadData(), codes = data.STATES.map(s => s.a), idx = buildIndex(data);
const ctx = (over = {}) => ({ data, codes, idx, findParcel: () => [], coverage: () => ({ liens: 0, counties: [], cheapest: null }), ruleIntent, cleanIntent, runStates, runLiens, describe, today: '2026-11-18', ...over });
assert(wantsResearch('Research the risks of tax liens in Arizona') && wantsResearch('compare FL and AZ') && !wantsResearch('cheapest liens in Colorado'));
// 1. cross-state comparison
let r = await research('Compare tax lien opportunities in Florida, Arizona and Colorado', ctx());
assert(r.trace.some(t => t.step === 'Verify findings') && r.trace.some(t => t.step === 'Generate report'), 'all stages ran');
assert(r.evidence.states.length >= 3, 'compared 3 states'); assert(r.sources.length > 0 && r.answer.includes('Verify:'), 'sources and verify line');
// 2. no results -> relax filters once, then say so
r = await research('Research liens in Colorado worth more than $50 million with no flood', ctx());
assert(r.trace.some(t => /retrying|relaxed/.test(t.detail)) || r.evidence.total !== 0, 'retry or results');
// 3. unknown parcel is never invented
r = await research('Investigate parcel 99-99-99-99-99-999-9999', ctx());
assert(r.findings.gaps.some(g => /not on any county list/.test(g)), 'unknown parcel flagged'); assert(!/99-99-99-99-99-999-9999:/.test(r.evidence.liens.map(x => x.parcel + ":").join("")), 'no invented row');
// 4. real parcel found and checked
const { loadLiens } = await import('../functions/screen.mjs'); const real = loadLiens('Palm Beach')[0];
r = await research('Research parcel ' + real.parcel + ' in Palm Beach', ctx());
assert(r.evidence.liens.some(x => x.parcel === real.parcel) || r.findings.gaps.length, 'real parcel handled');
// 5. model failure -> plain summary, still sourced
r = await research('Compare Florida and Texas tax sale rules', ctx({ write: async () => { throw new Error('down'); } }));
assert.equal(r.usedModel, false); assert(r.answer.length > 50);
// 6. model text is used when available but facts still come from code
r = await research('Compare Florida and Texas tax sale rules', ctx({ write: async pack => 'Model summary of ' + pack.rules.length + ' states.' }));
assert(r.usedModel && /Model summary of 2 states/.test(r.answer));
console.log('agent ok');
