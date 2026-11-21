import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the exact owner coverage calculation without auth, AI credits,
// network requests or persistent Netlify storage.
const source=fs.readFileSync('netlify/functions/owner-map-coverage.mjs','utf8');
const start=source.indexOf('async function liveSynopsis(d){');
const end=source.indexOf('async function datasetDetail(d)',start);
assert.ok(start>=0&&end>start,'coverage calculation must exist');
async function calculate(recs,patches,mapped=0){
 const scope={synopsis:d=>({...d,missing:d.records-d.mapped}),
  patches:async()=>patches,
  readStatic:async()=>({recs}),
  Set,Math,Object};
 vm.runInNewContext(source.slice(start,end)+'; globalThis.calc=liveSynopsis;',scope);
 return scope.calc({id:'MI-wayne',state:'MI',county:'Wayne',file:'MI-wayne.json',records:4161,mapped});
}
test('Wayne coverage counts only corrected parcels genuinely missing geometry',async()=>{
 const data=[{i:'a',p:'01'},{i:'b',p:'02',g:[[[1,2]]]},{i:'c',p:'03',cx:[-83,42]}];
 const r=await calculate(data,{a:{},b:{},c:{},orphan:{}},1);
 assert.equal(r.verifiedCorrections,1);
 assert.equal(r.mapped,2);
 assert.equal(r.missing,4159);
});
test('missing count stays unchanged for stale patches or empty correction feed',async()=>{
 for(const patches of [{orphan:{}},{}]){
  const r=await calculate([{i:'a',p:'01'}],patches,1);
  assert.equal(r.verifiedCorrections,0);
  assert.equal(r.missing,4160);
 }
});
