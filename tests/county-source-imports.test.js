'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {run}=require('../scripts/run-county-source-imports');
test('empty manifest does not fetch or write',async()=>assert.deepEqual(await run([]),[]));
test('invalid manifest is rejected',async()=>assert.rejects(run([{id:'../escape',state:'FL',county:'Lee County',url:'https://example.com/data.json',format:'records'}]),/Invalid source/));
test('rejects non-HTTPS sources',async()=>{const r=await run([{id:'lee-test',state:'FL',county:'Lee County',url:'http://example.com/data.json',format:'records'}]);assert.equal(r[0].ok,false)});
