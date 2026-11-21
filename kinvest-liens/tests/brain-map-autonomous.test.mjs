import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {verifyOfficial} from '../../netlify/lib/brain-official-verification.mjs';
const fixture=JSON.parse(fs.readFileSync('kinvest-liens/tests/fixtures/detroit-01002263.json','utf8'));
const record={i:'MI|Wayne|01002263|',p:'01002263',a:'90 Chandler, Detroit MI 48202'};
test('official evidence fills notes and geometry only after exact ID, street and polygon checks',()=>{
 const result=verifyOfficial(record,[fixture.feature]);
 assert.match(result.notes,/01002263/);assert.deepEqual(result.g,fixture.feature.geometry.rings);
 for(const features of [[],[fixture.feature,fixture.feature],
  [{...fixture.feature,attributes:{...fixture.feature.attributes,parcel_number:'01002264'}}],
  [{...fixture.feature,attributes:{...fixture.feature.attributes,address:'92 CHANDLER'}}],
  [{...fixture.feature,geometry:{rings:[[[0,0],[1,0],[1,1],[0,0]]]}}],
  [{...fixture.feature,geometry:{rings:[[[ -83.1,42.3],[-83.099,42.3],[-83.098,42.3],[-83.1,42.3]]]}}]
 ])assert.throws(()=>verifyOfficial(record,features));
 assert.throws(()=>verifyOfficial({...record,g:[]},[fixture.feature]));
});
test('scheduled agent discovers a missing parcel and fills an attributed verification decision without owner input',async()=>{
 const saved=new Map(),urls=[];
 const context=vm.createContext({URLSearchParams,AbortSignal,Buffer,console,fetch:async url=>{
  urls.push(String(url));return {ok:true,text:async()=>JSON.stringify(String(url).includes('/map/data/')?{recs:[record]}:{features:[fixture.feature]})};
 }});
 const auth=new vm.SyntheticModule(['kvGet','kvPut','withBrainStore'],function(){this.setExport('kvGet',async k=>structuredClone(saved.get(k)));this.setExport('kvPut',async(k,v)=>saved.set(k,structuredClone(v)));this.setExport('withBrainStore',h=>h);},{context});
 const c=new vm.SyntheticModule(['default'],function(){this.setExport('default',crypto);},{context});
 const verify=new vm.SyntheticModule(['verifyOfficial'],function(){this.setExport('verifyOfficial',verifyOfficial);},{context});
 const worker=new vm.SourceTextModule(fs.readFileSync('netlify/functions/owner-brain-auto.mjs','utf8'),{context});
 await worker.link(s=>s==='node:crypto'?c:s.includes('verification')?verify:auth);await worker.evaluate();
 await worker.namespace.default();
 const entry=saved.get('owner-brain-approvals-v1').entries[0];
 assert.equal(entry.reviewedBy,'automated-official-source-validator');
 assert.equal(entry.decision,'approved_for_staging');assert.match(entry.notes,/90 CHANDLER/);
 assert.equal(saved.get('owner-brain-scanner-v1').queue[0].verification.caseKey,entry.caseKey);
 assert.ok(urls.some(u=>new URL(u).searchParams.get('where')==='object_id=279374'));
});
